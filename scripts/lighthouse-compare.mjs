#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_REFERENCE_URL = "https://www.airbnb.com/rooms/47648006";
const DEFAULT_OUT = path.join(process.cwd(), "bench", "lighthouse-compare.json");

function arg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function flag(name) {
  return process.argv.includes(name);
}

function help() {
  console.log(`Usage: node scripts/lighthouse-compare.mjs --target <url> [--reference <url>] [--out <path>] [--preset desktop|mobile]

Runs Lighthouse against a target hifi URL and a reference Airbnb listing URL,
then diffs the headline metrics so we can sanity-check the hifi suite's
realism. Requires the "lighthouse" npm CLI to be reachable via "npx -y".

Examples:
  node scripts/lighthouse-compare.mjs \\
    --target https://cf-bench-next.example.workers.dev/hifi/stays/001 \\
    --reference https://www.airbnb.com/rooms/47648006

Flags:
  --target <url>      Required. Framework hifi route URL.
  --reference <url>   Optional. Defaults to ${DEFAULT_REFERENCE_URL}.
  --preset <kind>     mobile (default) or desktop.
  --out <path>        Output JSON. Defaults to bench/lighthouse-compare.json.
  --skip-network      Skip network-throttled run (for offline smoke).
  --help              Print this message.
`);
}

if (flag("--help")) {
  help();
  process.exit(0);
}

const targetUrl = arg("--target", null);
const referenceUrl = arg("--reference", DEFAULT_REFERENCE_URL);
const preset = (arg("--preset", "mobile") || "mobile").toLowerCase();
const outPath = arg("--out", DEFAULT_OUT);
const skipNetwork = flag("--skip-network");

if (!targetUrl) {
  console.error("Missing --target <url>. See --help.");
  process.exit(1);
}
if (preset !== "mobile" && preset !== "desktop") {
  console.error(`Unknown --preset ${preset}. Supported: mobile, desktop.`);
  process.exit(1);
}

async function runLighthouse(url, label) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-bench-lh-"));
  const reportPath = path.join(tmpDir, `${label}.report.json`);
  const args = [
    "-y",
    "lighthouse@12",
    url,
    "--quiet",
    "--output=json",
    `--output-path=${reportPath}`,
    "--chrome-flags=--headless=new --disable-dev-shm-usage --no-sandbox",
    `--preset=${preset === "desktop" ? "desktop" : "perf"}`,
    "--only-categories=performance",
  ];
  if (skipNetwork) args.push("--throttling-method=provided");
  console.log(`Lighthouse: ${label} ${url}`);
  await new Promise((resolve, reject) => {
    const child = spawn("npx", args, { stdio: ["ignore", "inherit", "inherit"] });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`lighthouse exited ${code} for ${label}`));
    });
  });
  const raw = await fs.readFile(reportPath, "utf8");
  const report = JSON.parse(raw);
  return { report, reportPath };
}

function pickMetric(report, auditId) {
  const audit = report?.audits?.[auditId];
  return Number.isFinite(audit?.numericValue) ? audit.numericValue : null;
}

function summarize(report) {
  return {
    fetchTime: report?.fetchTime ?? null,
    finalUrl: report?.finalUrl ?? report?.requestedUrl ?? null,
    score: report?.categories?.performance?.score ?? null,
    metrics: {
      lcp: pickMetric(report, "largest-contentful-paint"),
      fcp: pickMetric(report, "first-contentful-paint"),
      tbt: pickMetric(report, "total-blocking-time"),
      cls: pickMetric(report, "cumulative-layout-shift"),
      tti: pickMetric(report, "interactive"),
      speedIndex: pickMetric(report, "speed-index"),
      ttfb: pickMetric(report, "server-response-time"),
    },
    bytes: {
      totalBytes: pickMetric(report, "total-byte-weight"),
      scriptBytes: report?.audits?.["script-treemap-data"]?.details?.nodes?.reduce(
        (acc, n) => acc + (Number.isFinite(n?.resourceBytes) ? n.resourceBytes : 0),
        0
      ) ?? null,
      mainThreadMs: pickMetric(report, "mainthread-work-breakdown"),
      bootupTimeMs: pickMetric(report, "bootup-time"),
    },
  };
}

function ratio(target, reference) {
  if (!Number.isFinite(target) || !Number.isFinite(reference) || reference === 0) return null;
  return Number((target / reference).toFixed(3));
}

function buildDiff(targetSummary, referenceSummary) {
  const out = { metrics: {}, bytes: {} };
  for (const key of Object.keys(targetSummary.metrics)) {
    out.metrics[key] = {
      target: targetSummary.metrics[key],
      reference: referenceSummary.metrics[key],
      delta:
        Number.isFinite(targetSummary.metrics[key]) && Number.isFinite(referenceSummary.metrics[key])
          ? Number((targetSummary.metrics[key] - referenceSummary.metrics[key]).toFixed(2))
          : null,
      ratio: ratio(targetSummary.metrics[key], referenceSummary.metrics[key]),
    };
  }
  for (const key of Object.keys(targetSummary.bytes)) {
    out.bytes[key] = {
      target: targetSummary.bytes[key],
      reference: referenceSummary.bytes[key],
      delta:
        Number.isFinite(targetSummary.bytes[key]) && Number.isFinite(referenceSummary.bytes[key])
          ? Number((targetSummary.bytes[key] - referenceSummary.bytes[key]).toFixed(2))
          : null,
      ratio: ratio(targetSummary.bytes[key], referenceSummary.bytes[key]),
    };
  }
  return out;
}

async function main() {
  const ts = new Date().toISOString();
  const targetRun = await runLighthouse(targetUrl, "target");
  const referenceRun = await runLighthouse(referenceUrl, "reference");
  const targetSummary = summarize(targetRun.report);
  const referenceSummary = summarize(referenceRun.report);
  const diff = buildDiff(targetSummary, referenceSummary);
  const verdict = {
    jsBytesWithin2x:
      diff.bytes.scriptBytes?.ratio != null && diff.bytes.scriptBytes.ratio >= 0.5 && diff.bytes.scriptBytes.ratio <= 2,
    tbtWithin2x:
      diff.metrics.tbt?.ratio != null && diff.metrics.tbt.ratio >= 0.5 && diff.metrics.tbt.ratio <= 2,
    lcpWithin2x:
      diff.metrics.lcp?.ratio != null && diff.metrics.lcp.ratio >= 0.5 && diff.metrics.lcp.ratio <= 2,
  };
  const payload = {
    ts,
    preset,
    skipNetwork,
    targetUrl,
    referenceUrl,
    target: targetSummary,
    reference: referenceSummary,
    diff,
    verdict,
  };
  const absOut = path.isAbsolute(outPath) ? outPath : path.resolve(process.cwd(), outPath);
  await fs.mkdir(path.dirname(absOut), { recursive: true });
  await fs.writeFile(absOut, JSON.stringify(payload, null, 2));
  console.log(`Lighthouse compare written to ${path.relative(process.cwd(), absOut)}`);
  console.log(`Performance score — target: ${targetSummary.score}, reference: ${referenceSummary.score}`);
  console.log(
    `Metric ratios (target/reference):` +
      ` LCP=${diff.metrics.lcp?.ratio ?? "n/a"} TBT=${diff.metrics.tbt?.ratio ?? "n/a"} JS=${diff.bytes.scriptBytes?.ratio ?? "n/a"}`
  );
}

await main();
