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
const profile = argValue("--profile", "parity");
const summaryPath = path.resolve(process.cwd(), argValue("--out", "bench/results.v4.stability.json"));
const keepResults = hasFlag("--keep-results");
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
  profile,
  keepResults,
  rawOutputDir: keepResults ? rawBaseDir : null,
  runs: [],
};

try {
  await fs.mkdir(path.dirname(summaryPath), { recursive: true });
  if (keepResults) await fs.mkdir(rawBaseDir, { recursive: true });

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
          "1",
          "--profile",
          profile,
          "--out",
          outPath,
          ...sharedArgs,
        ]
      );

      runRecord.suites.push({
        suite,
        durationMs,
        outPath: keepResults ? path.relative(process.cwd(), outPath) : null,
      });
    }
    summary.runs.push(runRecord);
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
    `- profile: ${summary.profile}`,
    `- rawOutputDir: ${summary.rawOutputDir || "<temp cleaned>"}`,
    ...(summary.error ? [`- error: ${summary.error}`] : []),
    "",
    "| Repeat | Suite | Duration ms | Raw output |",
    "| --- | --- | ---: | --- |",
    ...summary.runs.flatMap((runRecord) =>
      runRecord.suites.map(
        (suite) =>
          `| ${runRecord.repeat} | ${suite.suite} | ${suite.durationMs} | ${suite.outPath || "<temp cleaned>"} |`
      )
    ),
    "",
  ].join("\n");

  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  await fs.writeFile(outBaseToMarkdown(summaryPath), `${markdown}\n`);

  if (!keepResults) {
    await fs.rm(rawBaseDir, { recursive: true, force: true });
  }
}

console.log(`Stability summary written to ${path.relative(process.cwd(), summaryPath)}`);
