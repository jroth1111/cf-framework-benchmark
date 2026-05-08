#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function outBaseToMarkdown(outPath) {
  return outPath.replace(/\.json$/i, ".md");
}

function finiteNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

const STABILITY_METRICS = [
  "ttfb",
  "lcp",
  "tbt",
  "scriptBootMs",
  "heapUsed",
  "chartSwitchMs",
  "chartDrawMs",
  "clientNavMs",
];

function summaryKey(suite, row, metric) {
  return [
    suite,
    row.profile,
    row.phase,
    row.scenario,
    row.bucketKeyScenario || "unknown-bucket",
    row.framework,
    metric,
  ].join("::");
}

function extractMetricSamples(suite, result) {
  const samples = [];
  const summaryRows = Array.isArray(result.summary) ? result.summary : [];
  for (const row of summaryRows) {
    for (const metric of STABILITY_METRICS) {
      const value = finiteNumber(row[metric]?.p50);
      if (value == null) continue;
      samples.push({
        key: summaryKey(suite, row, metric),
        suite,
        framework: row.framework,
        profile: row.profile,
        phase: row.phase,
        scenario: row.scenario,
        bucket: row.bucketKeyScenario || "unknown-bucket",
        metric,
        value,
      });
    }
  }
  return samples;
}

function driftViolations(metricSamples, { maxDriftPct }) {
  const byKey = new Map();
  for (const sample of metricSamples) {
    const entry = byKey.get(sample.key) || {
      ...sample,
      values: [],
    };
    entry.values.push(sample.value);
    byKey.set(sample.key, entry);
  }

  const violations = [];
  for (const entry of byKey.values()) {
    if (entry.values.length < 2) continue;
    const center = median(entry.values);
    if (!center || center <= 0) continue;
    const min = Math.min(...entry.values);
    const max = Math.max(...entry.values);
    const driftPct = ((max - min) / center) * 100;
    if (driftPct > maxDriftPct) {
      violations.push({
        suite: entry.suite,
        framework: entry.framework,
        profile: entry.profile,
        phase: entry.phase,
        scenario: entry.scenario,
        bucket: entry.bucket,
        metric: entry.metric,
        samples: entry.values.length,
        min,
        median: center,
        max,
        driftPct,
      });
    }
  }

  return violations.sort((a, b) => b.driftPct - a.driftPct);
}

async function run(label, args) {
  const startedAt = Date.now();
  await new Promise((resolve, reject) => {
    const child = spawn("pnpm", args, {
      stdio: "inherit",
      env: process.env,
      shell: false,
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with exit code ${code}`));
    });
    child.on("error", reject);
  });
  return Date.now() - startedAt;
}

function jsonPath(baseDir, suite, repeat) {
  return path.join(baseDir, `results.v4.${suite}.stability.run${repeat}.json`);
}

const repeats = Math.max(1, Number(argValue("--repeats", "3")) || 3);
const iterations = Math.max(1, Number(argValue("--iterations", "1")) || 1);
const profile = argValue("--profile", "parity");
const maxDriftPct = Math.max(0, Number(argValue("--max-drift-pct", "10")) || 10);
const summaryPath = path.resolve(process.cwd(), argValue("--out", "bench/results.v4.stability.json"));
const keepResults = hasFlag("--keep-results");
const allowCrossEra = hasFlag("--allow-cross-era");
const repoBenchDir = path.dirname(summaryPath);
const rawBaseDir = keepResults
  ? path.resolve(process.cwd(), argValue("--out-dir", path.join(repoBenchDir, "results.v4.stability.runs")))
  : await fs.mkdtemp(path.join(os.tmpdir(), "cf-bench-stability-"));

const passThroughPairs = ["--matrix", "--targets", "--suites-dir", "--only"];
const sharedArgs = [];
for (const flag of passThroughPairs) {
  const value = argValue(flag, null);
  if (value != null) sharedArgs.push(flag, value);
}

const summary = {
  ts: new Date().toISOString(),
  repeats,
  iterations,
  profile,
  keepResults,
  rawOutputDir: keepResults ? rawBaseDir : null,
  driftBudget: {
    maxDriftPct,
    metrics: STABILITY_METRICS,
    violations: [],
  },
  runs: [],
};

try {
  await fs.mkdir(path.dirname(summaryPath), { recursive: true });
  if (keepResults) await fs.mkdir(rawBaseDir, { recursive: true });

  const metricSamples = [];
  const observedEras = new Set();
  for (let repeat = 1; repeat <= repeats; repeat += 1) {
    const runRecord = { repeat, suites: [] };
    for (const suite of ["mpa_airbnb", "spa_trading_media"]) {
      const outPath = jsonPath(rawBaseDir, suite, repeat);
      const durationMs = await run(
        `bench ${suite} repeat ${repeat}`,
        [
          "-C",
          "bench",
          "exec",
          "node",
          "src/run-v4.mjs",
          "--suite",
          suite,
          "--iterations",
          String(iterations),
          "--profile",
          profile,
          "--out",
          outPath,
          ...sharedArgs,
        ]
      );

      const result = JSON.parse(await fs.readFile(outPath, "utf8"));
      const samples = extractMetricSamples(suite, result);
      metricSamples.push(...samples);

      // Collect platform eras from this run's rows for cross-era detection
      const rows = Array.isArray(result.summary) ? result.summary : [];
      for (const row of rows) {
        if (row.platformEra) observedEras.add(row.platformEra);
      }

      runRecord.suites.push({
        suite,
        durationMs,
        metricSamples: samples.length,
        outPath: keepResults ? path.relative(process.cwd(), outPath) : null,
      });
    }
    summary.runs.push(runRecord);
  }

  // Cross-era guard: reject mixed-era comparisons unless --allow-cross-era is passed.
  // This can occur if a platform era changes between stability repeats.
  if (observedEras.size > 1 && !allowCrossEra) {
    throw new Error(
      `Cross-era stability run detected: observed platform eras [${[...observedEras].join(', ')}]. ` +
      `Pass --allow-cross-era to compare across era boundaries.`
    );
  }
  summary.platformEras = [...observedEras];

  summary.driftBudget.violations = driftViolations(metricSamples, { maxDriftPct });
  if (summary.driftBudget.violations.length) {
    throw new Error(
      `stability drift budget exceeded: ${summary.driftBudget.violations.length} metric(s) exceeded ${maxDriftPct}%`
    );
  }

  summary.ok = true;
} catch (error) {
  summary.ok = false;
  summary.error = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  const markdown = [
    "# Benchmark Stability",
    "",
    `- ok: ${summary.ok === true ? "true" : "false"}`,
    `- repeats: ${summary.repeats}`,
    `- iterations: ${summary.iterations}`,
    `- profile: ${summary.profile}`,
    `- maxDriftPct: ${summary.driftBudget.maxDriftPct}`,
    `- rawOutputDir: ${summary.rawOutputDir || "<temp cleaned>"}`,
    `- platformEras: ${summary.platformEras?.join(', ') || '—'}`,
    ...(summary.error ? [`- error: ${summary.error}`] : []),
    "",
    "| Repeat | Suite | Duration ms | Metric samples | Raw output |",
    "| --- | --- | ---: | ---: | --- |",
    ...summary.runs.flatMap((runRecord) =>
      runRecord.suites.map(
        (suite) =>
          `| ${runRecord.repeat} | ${suite.suite} | ${suite.durationMs} | ${suite.metricSamples} | ${suite.outPath || "<temp cleaned>"} |`
      )
    ),
    "",
    "## Drift Budget",
    "",
    summary.driftBudget.violations.length
      ? "| Suite | Framework | Profile | Phase | Scenario | Metric | Samples | Min | Median | Max | Drift % |\n| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |\n" +
        summary.driftBudget.violations
          .slice(0, 100)
          .map(
            (v) =>
              `| ${v.suite} | ${v.framework} | ${v.profile} | ${v.phase} | ${v.scenario} | ${v.metric} | ${v.samples} | ${v.min.toFixed(2)} | ${v.median.toFixed(2)} | ${v.max.toFixed(2)} | ${v.driftPct.toFixed(1)} |`
          )
          .join("\n")
      : "No drift violations.",
    "",
  ].join("\n");

  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  await fs.writeFile(outBaseToMarkdown(summaryPath), `${markdown}\n`);

  if (!keepResults) {
    await fs.rm(rawBaseDir, { recursive: true, force: true });
  }
}

console.log(`Stability summary written to ${path.relative(process.cwd(), summaryPath)}`);
