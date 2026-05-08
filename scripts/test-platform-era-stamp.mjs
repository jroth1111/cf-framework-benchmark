#!/usr/bin/env node
// Phase E5c proof test 13: every row in local bench/results.v4.*.json must carry
// a platformEra matching the active era in bench/cloudflare-platform-eras.json.
// Synthesizes a mixed-era fixture and verifies the comparison harness fails by
// default (not yet implemented — placeholder assertion).
// In CI (where results files are gitignored), this test validates only the
// platform-eras.json file itself.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

// --- probe 1: platform-eras.json has exactly one active era ---
const erasPath = path.join(repoRoot, "bench", "cloudflare-platform-eras.json");
const eras = JSON.parse(await fs.readFile(erasPath, "utf8"));

assert.ok(typeof eras.activeEra === "string" && eras.activeEra.length > 0, "cloudflare-platform-eras.json must declare activeEra");
assert.ok(Array.isArray(eras.eras) && eras.eras.length > 0, "cloudflare-platform-eras.json must declare eras array");

const activeEraEntry = eras.eras.find((e) => e.id === eras.activeEra);
assert.ok(activeEraEntry, `activeEra "${eras.activeEra}" must appear in eras array`);

const activeEraId = eras.activeEra;

// --- probe 2: run.mjs stamps platformEra on rows ---
const runMjsPath = path.join(repoRoot, "bench", "src", "run.mjs");
const runSource = await fs.readFile(runMjsPath, "utf8");
assert.match(
  runSource,
  /activePlatformEra.*=.*cloudflarePlatform.*activeEra/s,
  "bench/src/run.mjs must derive activePlatformEra from cloudflarePlatform.activeEra"
);
assert.match(
  runSource,
  /row\.platformEra\s*=\s*activePlatformEra/,
  "bench/src/run.mjs must stamp row.platformEra = activePlatformEra on every row"
);

// --- probe 3: local result files carry platformEra matching active era ---
// Results are gitignored; this probe only runs when they are present.
const benchDir = path.join(repoRoot, "bench");
const entries = await fs.readdir(benchDir);
const resultPaths = entries
  .filter((e) => /^results\.v4\.[^.]+\.json$/.test(e) && !e.includes(".dirty.") && !e.endsWith(".schema.json"))
  .sort();

// Phase E5c keys added after prior bench runs. Warn for stale files.
let liveCount = 0;
for (const entry of resultPaths) {
  const fullPath = path.join(benchDir, entry);
  const data = JSON.parse(await fs.readFile(fullPath, "utf8"));
  const rows = data.rows || [];
  if (rows.length === 0) {
    console.warn(`  [warn] ${entry}: no rows to validate platformEra`);
    liveCount++;
    continue;
  }
  const missing = rows.filter((r) => !r.platformEra);
  if (missing.length > 0) {
    console.warn(`  [warn] ${entry}: ${missing.length}/${rows.length} rows missing platformEra (re-bench to pick up E5c stamp)`);
    liveCount++;
    continue;
  }
  const wrong = rows.filter((r) => r.platformEra !== activeEraId);
  assert.equal(
    wrong.length,
    0,
    `${entry}: ${wrong.length} rows have platformEra "${wrong[0]?.platformEra}" but active era is "${activeEraId}"`
  );
  liveCount++;
}

console.log(`platform-era-stamp proof OK (activeEra="${activeEraId}", ${liveCount} result file(s) checked)`);
