#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  DEFAULT_MATRIX_PATH,
  DEFAULT_SUITES_DIR,
  DEFAULT_TARGETS_PATH,
  loadSuite,
  parseCsvSet,
  resolveLiveTargets,
  toAbsolutePath,
} from "../bench/src/config-v4.mjs";
import { BENCH_MEDIA_PAGE_SIZE, chartSymbols, chartTimeframes } from "../packages/dataset/src/index.js";

const require = createRequire(new URL("../bench/package.json", import.meta.url));
const { chromium } = require("playwright");

const contractV5 = JSON.parse(
  readFileSync(new URL("../contracts/v5.json", import.meta.url), "utf8")
);

const REQUIRED_TEST_IDS_BY_ROUTE = new Map(
  contractV5.routes.map((entry) => [entry.route, new Set(entry.requiredTestIds ?? [])])
);

function contractTestIdSelector(route, testId) {
  const ids = REQUIRED_TEST_IDS_BY_ROUTE.get(route);
  if (!ids?.has(testId)) {
    const known = ids ? Array.from(ids).join(", ") : "<route missing>";
    throw new Error(
      `smoke.mjs requested data-testid "${testId}" for ${route}, but contracts/v5.json#requiredTestIds[${route}] = [${known}]`
    );
  }
  return `[data-testid=${testId}]`;
}

const CHART_CANVAS = contractTestIdSelector("/chart", "chart-canvas");
const CHART_SYMBOL_SELECT = contractTestIdSelector("/chart", "symbol-select");
const CHART_TIMEFRAME_SELECT = contractTestIdSelector("/chart", "timeframe-select");
const MEDIA_CARD = contractTestIdSelector("/media", "media-card");
const MEDIA_PLAYER = contractTestIdSelector("/media", "media-player");
const MEDIA_NEXT = contractTestIdSelector("/media", "media-next");

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

const timeoutMs = Number(argValue("--timeout", "15000"));
const headed = process.argv.includes("--headed");
const slowMo = Number(argValue("--slowmo", "0"));
const only = parseCsvSet(argValue("--only", ""));
const suiteNames = parseCsvSet(argValue("--suites", "mpa_airbnb,spa_trading_media"));
const targetsPath = toAbsolutePath(argValue("--targets", null), DEFAULT_TARGETS_PATH);
const matrixPath = toAbsolutePath(argValue("--matrix", null), DEFAULT_MATRIX_PATH);
const suitesDir = toAbsolutePath(argValue("--suites-dir", null), DEFAULT_SUITES_DIR);

function hasMediaInteraction(scenario) {
  return (
    String(scenario?.name || "").toLowerCase().includes("media") ||
    (Array.isArray(scenario?.interactions) &&
      scenario.interactions.some((item) => String(item?.kind || "").toLowerCase().startsWith("media")))
  );
}

function hasChartInteraction(scenario) {
  return (
    String(scenario?.name || "").toLowerCase().includes("chart") ||
    (Array.isArray(scenario?.interactions) &&
      scenario.interactions.some((item) => String(item?.kind || "").toLowerCase().startsWith("chart")))
  );
}

function frameworkSupportsHifi(framework) {
  return framework?.matrix?.hifi?.enabled === true;
}

const frameworks = await resolveLiveTargets({
  matrixPath,
  targetsPath,
  only,
  requireWorkers: true,
  requireEnabled: true,
});

const suites = await Promise.all([...suiteNames].map((name) => loadSuite(name, suitesDir)));
const scenarios = suites
  .flatMap((suite) => suite.scenarios.map((scenario) => ({ ...scenario, suiteId: suite.id })))
  .filter((scenario, idx, arr) => arr.findIndex((row) => row.path === scenario.path) === idx);

function scenariosForFramework(framework) {
  if (frameworkSupportsHifi(framework)) return scenarios;
  return scenarios.filter((scenario) => !String(scenario.path || "").startsWith("/hifi/"));
}

if (!scenarios.length) {
  throw new Error("No scenarios resolved from selected suites.");
}

const browser = await chromium.launch({
  headless: !headed,
  slowMo: Number.isFinite(slowMo) ? slowMo : 0,
});

const failures = [];

async function gotoScenario(page, baseUrl, scenario) {
  await page.goto(`${baseUrl}${scenario.path}`, { waitUntil: "domcontentloaded" });
  if (scenario.waitFor) {
    await page.waitForSelector(scenario.waitFor, { timeout: timeoutMs });
  }
}

async function assertVisibleLocator(page, selector, label) {
  const locator = page.locator(selector).first();
  const deadline = Date.now() + timeoutMs;
  let lastBox = null;
  while (Date.now() < deadline) {
    try {
      await locator.waitFor({ state: "visible", timeout: Math.min(1000, Math.max(1, deadline - Date.now())) });
      lastBox = await locator.boundingBox();
      if (lastBox && lastBox.width > 0 && lastBox.height > 0) return;
    } catch {
      lastBox = null;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`${label} selector ${selector} is not a visible, non-zero element: ${JSON.stringify(lastBox)}`);
}

async function validateScenarioSurface(page, scenario, label) {
  if (scenario.waitFor) {
    await assertVisibleLocator(page, scenario.waitFor, label);
  }
}

async function warmReloadDocumentScenario(page, scenario, label) {
  if (scenario.type !== "document") return;
  await page.reload({ waitUntil: "domcontentloaded" });
  await validateScenarioSurface(page, scenario, `${label} warm reload`);
}

async function waitForBenchHydration(page, scenario) {
  const waitsForMedia = hasMediaInteraction(scenario);
  const settled = await page
    .waitForFunction(
      ({ waitsForMedia }) => {
        const hydration = globalThis.__CF_BENCH__?.hydration;
        if (!waitsForMedia && globalThis.__CF_BENCH__?.chart?.ready === true) return true;
        if (waitsForMedia && globalThis.__CF_BENCH__?.media?.ready === true) return true;
        if (!hydration) return true;
        return Number.isFinite(hydration.endMs) || hydration.endMs === null;
      },
      { waitsForMedia },
      { timeout: timeoutMs }
    )
    .then(() => true)
    .catch(() => false);

  if (!settled) {
    const observed = await page.evaluate(() => globalThis.__CF_BENCH__ ?? null).catch(() => null);
    throw new Error(`hydration marker did not settle before interaction: ${JSON.stringify(observed)}`);
  }
  if (waitsForMedia) {
    await page.waitForTimeout(250);
  }
}

async function runChartInteractions(page, scenario) {
  await assertVisibleLocator(page, CHART_CANVAS, "chart canvas");
  await assertVisibleLocator(page, CHART_SYMBOL_SELECT, "chart symbol select");
  await assertVisibleLocator(page, CHART_TIMEFRAME_SELECT, "chart timeframe select");
  const chartOptionCounts = await page.evaluate(
    ({ symbolSelector, timeframeSelector }) => ({
      symbols: document.querySelectorAll(symbolSelector + " option").length,
      timeframes: document.querySelectorAll(timeframeSelector + " option").length,
    }),
    { symbolSelector: CHART_SYMBOL_SELECT, timeframeSelector: CHART_TIMEFRAME_SELECT }
  );
  if (chartOptionCounts.symbols !== chartSymbols.length || chartOptionCounts.timeframes !== chartTimeframes.length) {
    throw new Error(
      `chart workload option count mismatch: ${JSON.stringify({
        observed: chartOptionCounts,
        expected: { symbols: chartSymbols.length, timeframes: chartTimeframes.length },
      })}`
    );
  }
  try {
    await page.waitForFunction(() => globalThis.__CF_BENCH__?.chart?.ready === true, { timeout: timeoutMs });
  } catch (err) {
    const observed = await page.evaluate(() => globalThis.__CF_BENCH__ ?? null).catch(() => null);
    throw new Error(`initial chart ready marker missing: ${JSON.stringify(observed)}; ${err instanceof Error ? err.message : String(err)}`);
  }

  const config = Array.isArray(scenario.interactions)
    ? scenario.interactions.find((item) => String(item?.kind || "").startsWith("chart"))
    : null;
  const targetSymbol = config?.targetSymbol || "ETH";
  const targetTimeframe = config?.targetTimeframe || "15m";

  const symbolSelect = page.locator(CHART_SYMBOL_SELECT);
  const timeframeSelect = page.locator(CHART_TIMEFRAME_SELECT);
  const before = await page.evaluate(
    ({ symbolSelector, timeframeSelector }) => ({
      symbol: document.querySelector(symbolSelector)?.value ?? null,
      timeframe: document.querySelector(timeframeSelector)?.value ?? null,
    }),
    { symbolSelector: CHART_SYMBOL_SELECT, timeframeSelector: CHART_TIMEFRAME_SELECT }
  );

  try {
    await symbolSelect.selectOption(targetSymbol);
  } catch {
    const options = symbolSelect.locator("option");
    if ((await options.count()) > 1) await symbolSelect.selectOption({ index: 1 });
  }

  try {
    await timeframeSelect.selectOption(targetTimeframe);
  } catch {
    const options = timeframeSelect.locator("option");
    if ((await options.count()) > 1) await timeframeSelect.selectOption({ index: 1 });
  }

  const after = await page.evaluate(
    ({ symbolSelector, timeframeSelector }) => ({
      symbol: document.querySelector(symbolSelector)?.value ?? null,
      timeframe: document.querySelector(timeframeSelector)?.value ?? null,
    }),
    { symbolSelector: CHART_SYMBOL_SELECT, timeframeSelector: CHART_TIMEFRAME_SELECT }
  );
  if (after.symbol === before.symbol && after.timeframe === before.timeframe) {
    throw new Error(`chart controls did not change state: ${JSON.stringify({ before, after })}`);
  }

  try {
    await page.waitForFunction(() => globalThis.__CF_BENCH__?.chart?.ready === true, { timeout: timeoutMs });
  } catch (err) {
    const observed = await page.evaluate(() => globalThis.__CF_BENCH__ ?? null).catch(() => null);
    throw new Error(`chart ready marker missing: ${JSON.stringify(observed)}; ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    await page.waitForFunction(
      () =>
        Number.isFinite(globalThis.__CF_BENCH__?.chartCore?.lastDrawMs) &&
        Number.isFinite(globalThis.__CF_BENCH__?.chart?.switchDurationMs),
      { timeout: timeoutMs }
    );
  } catch (err) {
    const observed = await page.evaluate(() => globalThis.__CF_BENCH__ ?? null).catch(() => null);
    throw new Error(`chart metric markers missing: ${JSON.stringify(observed)}; ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function waitForMediaReady(page) {
  try {
    await page.waitForFunction(() => globalThis.__CF_BENCH__?.media?.ready === true, { timeout: timeoutMs });
  } catch (err) {
    const observed = await page.evaluate(() => globalThis.__CF_BENCH__ ?? null).catch(() => null);
    throw new Error(`media ready marker missing: ${JSON.stringify(observed)}; ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function waitForMediaChange(page, beforeText, beforeMediaId, label) {
  const deadline = Date.now() + timeoutMs;
  let last = { text: null, id: null };
  while (Date.now() < deadline) {
    last.text = await page.locator(MEDIA_PLAYER).first().textContent().catch(() => null);
    last.id = await page.evaluate(() => globalThis.__CF_BENCH__?.media?.currentId ?? null).catch(() => null);
    if (beforeText ? last.text && last.text !== beforeText : last.id && last.id !== beforeMediaId) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`${label} media interaction did not change player text or id: ${JSON.stringify({ beforeText, beforeMediaId, last })}`);
}

async function clickMediaAndWaitForChange(page, locator, beforeText, beforeMediaId, label) {
  const deadline = Date.now() + timeoutMs;
  let last = { text: null, id: null };
  while (Date.now() < deadline) {
    await locator.click().catch(() => null);
    const settleUntil = Math.min(Date.now() + 500, deadline);
    while (Date.now() < settleUntil) {
      last.text = await page.locator(MEDIA_PLAYER).first().textContent().catch(() => null);
      last.id = await page.evaluate(() => globalThis.__CF_BENCH__?.media?.currentId ?? null).catch(() => null);
      if (beforeText ? last.text && last.text !== beforeText : last.id && last.id !== beforeMediaId) return;
      await page.waitForTimeout(100);
    }
  }
  throw new Error(`${label} media interaction did not change player text or id: ${JSON.stringify({ beforeText, beforeMediaId, last })}`);
}

async function waitForMediaCardCount(page) {
  const cards = page.locator(MEDIA_CARD);
  const deadline = Date.now() + timeoutMs;
  let lastCount = 0;
  while (Date.now() < deadline) {
    lastCount = await cards.count();
    if (lastCount === BENCH_MEDIA_PAGE_SIZE) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`media-card count mismatch: ${lastCount}/${BENCH_MEDIA_PAGE_SIZE}`);
}

async function runMediaInteractions(page) {
  await assertVisibleLocator(page, MEDIA_CARD, "media card");
  await waitForMediaCardCount(page);
  const before = await page.locator(MEDIA_PLAYER).first().textContent().catch(() => null);
  const beforeId = await page.evaluate(() => globalThis.__CF_BENCH__?.media?.currentId ?? null).catch(() => null);
  const cards = page.locator(MEDIA_CARD);
  const cardTexts = await cards.allTextContents();
  const targetIndex = Math.max(
    0,
    cardTexts.findIndex((text, index) => index > 0 && before && !before.includes(text.trim().split(/\s+/).slice(0, 4).join(" ")))
  );
  const targetCard = (await cards.count()) > 1 ? cards.nth(targetIndex > 0 ? targetIndex : 1) : cards.first();
  await assertVisibleLocator(page, MEDIA_PLAYER, "media player");
  await clickMediaAndWaitForChange(page, targetCard, before, beforeId, "media-card");

  const next = page.locator(MEDIA_NEXT);
  if (await next.count()) {
    const beforeNext = await page.locator(MEDIA_PLAYER).first().textContent().catch(() => null);
    const beforeNextId = await page.evaluate(() => globalThis.__CF_BENCH__?.media?.currentId ?? null).catch(() => null);
    await clickMediaAndWaitForChange(page, next.first(), beforeNext, beforeNextId, "media-next");
  }
  await assertVisibleLocator(page, MEDIA_PLAYER, "media player after next");
  const after = await page.locator(MEDIA_PLAYER).first().textContent().catch(() => null);
  if (before && after && before === after) {
    throw new Error("media interaction did not change player text");
  }

  await waitForMediaReady(page);
}

async function runFramework(framework) {
  const baseUrl = framework.url.replace(/\/$/, "");
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);

  try {
    console.log(`\n${framework.name}`);
    for (const scenario of scenariosForFramework(framework)) {
      await gotoScenario(page, baseUrl, scenario);
      await validateScenarioSurface(page, scenario, `${framework.name} ${scenario.name}`);
      await warmReloadDocumentScenario(page, scenario, `${framework.name} ${scenario.name}`);
      if (hasChartInteraction(scenario) || hasMediaInteraction(scenario)) {
        await waitForBenchHydration(page, scenario);
      }
      if (hasChartInteraction(scenario)) await runChartInteractions(page, scenario);
      if (hasMediaInteraction(scenario)) await runMediaInteractions(page);
    }
  } catch (err) {
    failures.push(`${framework.name}: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await context.close();
  }
}

for (const framework of frameworks) {
  await runFramework(framework);
}

await browser.close();

if (failures.length) {
  console.error(`\nSmoke tests failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\nSmoke tests passed.");
