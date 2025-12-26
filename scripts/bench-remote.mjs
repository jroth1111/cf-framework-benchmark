#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

const apiKey = argValue("--api-key", process.env.WPT_API_KEY || "");
const endpoint = argValue("--endpoint", process.env.WPT_ENDPOINT || "https://www.webpagetest.org");
const locationsRaw = argValue("--locations", process.env.WPT_LOCATIONS || "");
const configPath = argValue("--config", path.join(process.cwd(), "bench", "bench.config.json"));
const outPath = argValue("--out", path.join(process.cwd(), "bench", "results.remote.json"));

if (!apiKey) {
  console.error("Missing WebPageTest API key. Set WPT_API_KEY or pass --api-key.");
  process.exit(1);
}

const locations = locationsRaw
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!locations.length) {
  console.error("Missing WPT locations. Set WPT_LOCATIONS or pass --locations.");
  process.exit(1);
}

const rawConfig = JSON.parse(await fs.readFile(configPath, "utf8"));
const frameworks = Array.isArray(rawConfig.frameworks) ? rawConfig.frameworks : [];

const SCENARIOS = [
  { name: "home", path: "/" },
  { name: "stays", path: "/stays" },
  { name: "blog", path: "/blog" },
  { name: "chart", path: "/chart" }
];

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWptTest(url, location) {
  const testUrl = `${endpoint}/runtest.php?f=json&k=${encodeURIComponent(apiKey)}&runs=1&fvonly=1&location=${encodeURIComponent(location)}&url=${encodeURIComponent(url)}`;
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

const results = [];

for (const fw of frameworks) {
  const baseUrl = (fw.url || "").replace(/\/$/, "");
  if (!baseUrl) continue;

  for (const scenario of SCENARIOS) {
    const url = `${baseUrl}${scenario.path}`;
    for (const location of locations) {
      console.log(`WPT: ${fw.name} ${scenario.name} @ ${location}`);
      try {
        const data = await runWptTest(url, location);
        const firstView = data.data.runs["1"].firstView;
        const record = {
          framework: fw.name,
          scenario: scenario.name,
          location,
          url,
          metrics: {
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
          },
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
          location,
          url,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}

await fs.writeFile(outPath, JSON.stringify({ ts: new Date().toISOString(), results }, null, 2));
console.log(`Remote results written to ${path.relative(process.cwd(), outPath)}`);
