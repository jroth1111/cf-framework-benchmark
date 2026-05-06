#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_MATRIX_PATH,
  DEFAULT_SUITES_DIR,
  DEFAULT_TARGETS_PATH,
  loadSuite,
  parseCsvSet,
  resolveLiveTargets,
  toAbsolutePath,
} from "../bench/src/config-v4.mjs";

const CANONICAL_WPT_LOCATIONS = [
  { region: "MEL", location: "MEL_AU_03:Chrome.Native" },
  { region: "US", location: "IAD_US_01:Chrome.Native" },
  { region: "EU", location: "DUB_IE_01:Chrome.Native" },
];
const MOBILE_WPT_LOCATIONS = [
  { region: "MEL", location: "MEL_AU_03:MotoG4.Chrome.3GFast" },
  { region: "US", location: "IAD_US_01:MotoG4.Chrome.3GFast" },
  { region: "EU", location: "DUB_IE_01:MotoG4.Chrome.3GFast" },
];
const HIFI_SUITE_ID = "mpa_airbnb_hifi";
const DEFAULT_WPT_LOCATIONS = CANONICAL_WPT_LOCATIONS.map((entry) => entry.location).join(",");

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

const apiKey = argValue("--api-key", process.env.WPT_API_KEY || "");
const endpoint = argValue("--endpoint", process.env.WPT_ENDPOINT || "https://www.webpagetest.org");
const targetsPath = toAbsolutePath(argValue("--targets", null), DEFAULT_TARGETS_PATH);
const matrixPath = toAbsolutePath(argValue("--matrix", null), DEFAULT_MATRIX_PATH);
const suitesDir = toAbsolutePath(argValue("--suites-dir", null), DEFAULT_SUITES_DIR);
const only = parseCsvSet(argValue("--only", ""));
const suiteNames = parseCsvSet(argValue("--suites", "mpa_airbnb,spa_trading_media"));
const outPath = argValue("--out", path.join(process.cwd(), "bench", "results.remote.json"));

const isHifiOnlySuite = suiteNames.size === 1 && suiteNames.has(HIFI_SUITE_ID);
const explicitMobile = process.argv.includes("--mobile");
const useMobileProfile = explicitMobile || isHifiOnlySuite;
const activeLocations = useMobileProfile ? MOBILE_WPT_LOCATIONS : CANONICAL_WPT_LOCATIONS;
const defaultLocations = activeLocations.map((entry) => entry.location).join(",");
const locationsRaw = argValue("--locations", process.env.WPT_LOCATIONS || defaultLocations);
const defaultRuns = useMobileProfile ? "5" : "3";
const wptRuns = Math.max(1, Number(argValue("--runs", process.env.WPT_RUNS || defaultRuns)));

if (!apiKey) {
  console.error("Missing WebPageTest API key. Set WPT_API_KEY or pass --api-key.");
  process.exit(1);
}

const locations = locationsRaw
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const frameworks = await resolveLiveTargets({
  matrixPath,
  targetsPath,
  only,
  requireWorkers: true,
  requireEnabled: true,
});

const suites = await Promise.all([...suiteNames].map((name) => loadSuite(name, suitesDir)));
const scenarios = suites
  .flatMap((suite) => suite.scenarios.map((scenario) => ({ name: scenario.name, path: scenario.path })))
  .filter((scenario, idx, arr) => arr.findIndex((row) => row.path === scenario.path) === idx);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWptTest(url, location, runs) {
  const testUrl = `${endpoint}/runtest.php?f=json&k=${encodeURIComponent(apiKey)}&runs=${encodeURIComponent(String(runs))}&fvonly=1&location=${encodeURIComponent(location)}&url=${encodeURIComponent(url)}`;
  const res = await fetch(testUrl);
  const data = await res.json();
  if (data.statusCode !== 200 || !data.data?.jsonUrl) {
    throw new Error(`WPT start failed (${data.statusCode}): ${data.statusText || "unknown"}`);
  }
  return await pollWptResult(data.data.jsonUrl);
}

async function pollWptResult(jsonUrl) {
  for (let i = 0; i < 40; i += 1) {
    const res = await fetch(jsonUrl);
    const data = await res.json();
    if (data.statusCode === 200 && data.data?.runs?.["1"]?.firstView) {
      return data;
    }
    await sleep(5000);
  }
  throw new Error("WPT result timeout");
}

function pickMetric(obj, keys) {
  for (const key of keys) {
    const value = key.split(".").reduce((acc, k) => (acc ? acc[k] : undefined), obj);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function firstViewRuns(data) {
  const runs = data?.data?.runs && typeof data.data.runs === "object" ? data.data.runs : {};
  return Object.entries(runs)
    .map(([runId, run]) => ({ runId, firstView: run?.firstView ?? null }))
    .filter((run) => run.firstView);
}

function metricsForFirstView(firstView) {
  return {
    ttfb: pickMetric(firstView, ["TTFB", "ttfb"]),
    fcp: pickMetric(firstView, [
      "firstContentfulPaint",
      "FirstContentfulPaint",
      "chromeUserTiming.firstContentfulPaint",
    ]),
    lcp: pickMetric(firstView, [
      "largestContentfulPaint",
      "LargestContentfulPaint",
      "chromeUserTiming.LargestContentfulPaint",
    ]),
    cls: pickMetric(firstView, [
      "CumulativeLayoutShift",
      "CLS",
      "chromeUserTiming.CumulativeLayoutShift",
    ]),
  };
}

function canonicalRegionForLocation(location) {
  const locationId = String(location).split(/[.:]/)[0];
  const pool = useMobileProfile ? MOBILE_WPT_LOCATIONS : CANONICAL_WPT_LOCATIONS;
  return pool.find((entry) => entry.location.startsWith(`${locationId}:`))?.region ?? null;
}

const results = [];

function frameworkIncludesScenario(fw, scenario) {
  if (scenario.path.startsWith("/hifi/")) return fw.matrix?.hifi?.enabled === true;
  return true;
}

for (const fw of frameworks) {
  const baseUrl = fw.url.replace(/\/$/, "");
  if (!baseUrl) continue;

  for (const scenario of scenarios) {
    if (!frameworkIncludesScenario(fw, scenario)) continue;
    const url = `${baseUrl}${scenario.path}`;
    for (const location of locations) {
      console.log(`WPT: ${fw.name} ${scenario.name} @ ${location}`);
      try {
        const data = await runWptTest(url, location, wptRuns);
        const runMetrics = firstViewRuns(data).map((run) => ({
          runId: run.runId,
          metrics: metricsForFirstView(run.firstView),
        }));
        const metricKeys = ["ttfb", "fcp", "lcp", "cls"];
        const record = {
          framework: fw.name,
          scenario: scenario.name,
          region: canonicalRegionForLocation(location),
          location,
          url,
          requestedRuns: wptRuns,
          completedRuns: runMetrics.length,
          metrics: Object.fromEntries(
            metricKeys.map((key) => [key, median(runMetrics.map((run) => run.metrics[key]))])
          ),
          runs: runMetrics,
          raw: {
            testId: data.data.id,
            summary: data.data.summary,
          },
        };
        results.push(record);
      } catch (err) {
        results.push({
          framework: fw.name,
          scenario: scenario.name,
          region: canonicalRegionForLocation(location),
          location,
          url,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}

await fs.writeFile(
  outPath,
  JSON.stringify(
    {
      ts: new Date().toISOString(),
      profile: useMobileProfile ? "mobile" : "desktop",
      canonicalLocations: activeLocations,
      requestedRuns: wptRuns,
      results,
    },
    null,
    2
  )
);
console.log(`Remote results (${useMobileProfile ? "mobile" : "desktop"}) written to ${path.relative(process.cwd(), outPath)}`);
