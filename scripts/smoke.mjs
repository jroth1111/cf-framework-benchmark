#!/usr/bin/env node
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
  await assertVisibleLocator(page, "[data-testid=chart-canvas]", "chart canvas");
  await assertVisibleLocator(page, "[data-testid=symbol-select]", "chart symbol select");
  await assertVisibleLocator(page, "[data-testid=timeframe-select]", "chart timeframe select");
  const chartOptionCounts = await page.evaluate(() => ({
    symbols: document.querySelectorAll('[data-testid="symbol-select"] option').length,
    timeframes: document.querySelectorAll('[data-testid="timeframe-select"] option').length,
  }));
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

  const symbolSelect = page.locator("[data-testid=symbol-select]");
  const timeframeSelect = page.locator("[data-testid=timeframe-select]");
  const before = await page.evaluate(() => ({
    symbol: document.querySelector('[data-testid="symbol-select"]')?.value ?? null,
    timeframe: document.querySelector('[data-testid="timeframe-select"]')?.value ?? null,
  }));

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

  const after = await page.evaluate(() => ({
    symbol: document.querySelector('[data-testid="symbol-select"]')?.value ?? null,
    timeframe: document.querySelector('[data-testid="timeframe-select"]')?.value ?? null,
  }));
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
    last.text = await page.locator("[data-testid=media-player]").first().textContent().catch(() => null);
    last.id = await page.evaluate(() => globalThis.__CF_BENCH__?.media?.currentId ?? null).catch(() => null);
    if (beforeText ? last.text && last.text !== beforeText : last.id && last.id !== beforeMediaId) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`${label} media interaction did not change player text or id: ${JSON.stringify({ beforeText, beforeMediaId, last })}`);
}

async function runMediaInteractions(page) {
  await assertVisibleLocator(page, "[data-testid=media-card]", "media card");
  const mediaCardCount = await page.locator("[data-testid=media-card]").count();
  if (mediaCardCount !== BENCH_MEDIA_PAGE_SIZE) {
    throw new Error(`media-card count mismatch: ${mediaCardCount}/${BENCH_MEDIA_PAGE_SIZE}`);
  }
  const before = await page.locator("[data-testid=media-player]").first().textContent().catch(() => null);
  const beforeId = await page.evaluate(() => globalThis.__CF_BENCH__?.media?.currentId ?? null).catch(() => null);
  const cards = page.locator("[data-testid=media-card]");
  const targetCard = (await cards.count()) > 1 ? cards.nth(1) : cards.first();
  await targetCard.click();
  await assertVisibleLocator(page, "[data-testid=media-player]", "media player");
  await waitForMediaChange(page, before, beforeId, "media-card");

  const next = page.locator("[data-testid=media-next]");
  if (await next.count()) {
    const beforeNext = await page.locator("[data-testid=media-player]").first().textContent().catch(() => null);
    const beforeNextId = await page.evaluate(() => globalThis.__CF_BENCH__?.media?.currentId ?? null).catch(() => null);
    await next.first().click();
    await waitForMediaChange(page, beforeNext, beforeNextId, "media-next");
  }
  await assertVisibleLocator(page, "[data-testid=media-player]", "media player after next");
  const after = await page.locator("[data-testid=media-player]").first().textContent().catch(() => null);
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
    for (const scenario of scenarios) {
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
