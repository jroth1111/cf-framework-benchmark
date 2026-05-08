#!/usr/bin/env node
// Phase E5d proof test 14: bench/src/run.mjs must not declare inline const TIMING = {...}
// or const NETWORK_PROFILES = {...} blocks — these must be imported from
// bench/runner-timings.json. Proves the single-declaration-site invariant.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const runMjsPath = path.join(repoRoot, "bench", "src", "run.mjs");
const source = await fs.readFile(runMjsPath, "utf8");

// These inline object literal patterns must NOT appear in run.mjs.
const forbidden = [
  { pattern: /\bconst TIMING\s*=\s*\{/, label: "inline const TIMING = {...}" },
  { pattern: /\bconst NETWORK_PROFILES\s*=\s*\{/, label: "inline const NETWORK_PROFILES = {...}" },
  { pattern: /\bconst NAV_RETRY\s*=\s*\{/, label: "inline const NAV_RETRY = {...}" },
  { pattern: /\bconst VIEWPORT\s*=\s*\{/, label: "inline const VIEWPORT = {...}" },
];

for (const { pattern, label } of forbidden) {
  assert.ok(
    !pattern.test(source),
    `bench/src/run.mjs must not contain ${label} — import from bench/runner-timings.json instead`
  );
}

// The catalog import must be present.
assert.match(
  source,
  /import runnerTimingsCatalog from ['"]\.\.\/runner-timings\.json['"]/,
  "bench/src/run.mjs must import runnerTimingsCatalog from '../runner-timings.json'"
);

// The runner-timings.json itself must be the single declaration site.
const catalogPath = path.join(repoRoot, "bench", "runner-timings.json");
const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
assert.ok(typeof catalog.timing === "object" && catalog.timing !== null, "runner-timings.json must have timing object");
assert.ok(typeof catalog.navRetry === "object" && catalog.navRetry !== null, "runner-timings.json must have navRetry object");
assert.ok(typeof catalog.viewport === "object" && catalog.viewport !== null, "runner-timings.json must have viewport object");
assert.ok(typeof catalog.networkProfiles === "object" && catalog.networkProfiles !== null, "runner-timings.json must have networkProfiles object");
assert.ok(typeof catalog.benchProfileHeader === "string", "runner-timings.json must have benchProfileHeader string");

// bench-config must NOT contain dead duplicate declarations.
const benchConfigPath = path.join(repoRoot, "packages", "bench-config", "src", "index.ts");
const benchConfigSource = await fs.readFile(benchConfigPath, "utf8");
const deadExports = [
  { pattern: /export const BENCHMARK_TIMING\s*=/, label: "BENCHMARK_TIMING" },
  { pattern: /export const NAV_RETRY\s*=/, label: "NAV_RETRY" },
  { pattern: /export const VIEWPORT\s*=/, label: "VIEWPORT" },
  { pattern: /export const NETWORK_PROFILES\s*=/, label: "NETWORK_PROFILES" },
];
for (const { pattern, label } of deadExports) {
  assert.ok(
    !pattern.test(benchConfigSource),
    `packages/bench-config/src/index.ts must not export ${label} — moved to bench/runner-timings.json`
  );
}

console.log("runner-imports-timings proof OK");
