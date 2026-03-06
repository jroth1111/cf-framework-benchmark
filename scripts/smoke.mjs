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

async function runChartInteractions(page, scenario) {
  await page.waitForSelector("[data-testid=chart-canvas]", { timeout: timeoutMs });
  await page.waitForSelector("[data-testid=symbol-select]", { timeout: timeoutMs });
  await page.waitForSelector("[data-testid=timeframe-select]", { timeout: timeoutMs });

  const config = Array.isArray(scenario.interactions)
    ? scenario.interactions.find((item) => String(item?.kind || "").startsWith("chart"))
    : null;
  const targetSymbol = config?.targetSymbol || "ETH";
  const targetTimeframe = config?.targetTimeframe || "15m";

  const symbolSelect = page.locator("[data-testid=symbol-select]");
  const timeframeSelect = page.locator("[data-testid=timeframe-select]");

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

  await page.waitForFunction(() => globalThis.__CF_BENCH__?.chart?.ready === true, { timeout: timeoutMs });
  await page.waitForFunction(
    () =>
      Number.isFinite(globalThis.__CF_BENCH__?.chartCore?.lastDrawMs) &&
      Number.isFinite(globalThis.__CF_BENCH__?.chart?.switchDurationMs),
    { timeout: timeoutMs }
  );
}

async function runMediaInteractions(page) {
  await page.waitForSelector("[data-testid=media-card]", { timeout: timeoutMs });
  await page.locator("[data-testid=media-card]").first().click();
  await page.waitForSelector("[data-testid=media-player]", { timeout: timeoutMs });

  const next = page.locator("[data-testid=media-next]");
  if (await next.count()) {
    await next.first().click();
  }

  await page.waitForFunction(() => globalThis.__CF_BENCH__?.media?.ready === true, { timeout: timeoutMs });
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
