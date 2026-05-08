#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const matrix = JSON.parse(
  await fs.readFile(path.join(repoRoot, "bench/framework-matrix.json"), "utf8")
);

const inScopeNames = matrix.frameworks
  .filter((f) => f.benchmarkEnabled || f.status === "blocked")
  .map((f) => f.name);

const ROUTE_FILE_EXTS = new Set([".ts", ".tsx", ".mts", ".js", ".mjs", ".vue"]);
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".next",
  ".output",
  ".vite",
  ".angular",
  ".redwood",
  ".astro",
  ".turbo",
  ".cache",
  ".svelte-kit",
]);

async function* walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function isApiRouteFile(relPath) {
  if (!ROUTE_FILE_EXTS.has(path.extname(relPath))) return false;
  const segments = relPath.split(path.sep);
  return segments.includes("api") || segments.some((s) => s.startsWith("api."));
}

const BENCH_CONTRACT_RE = /from\s+["']@cf-bench\/bench-contract["']/;

const violations = [];
const checked = [];
const skippedNoApiFiles = [];

for (const name of inScopeNames) {
  const appDir = path.join(repoRoot, "apps", name);
  let stat;
  try {
    stat = await fs.stat(appDir);
  } catch {
    continue;
  }
  if (!stat.isDirectory()) continue;

  const apiFiles = [];
  for await (const full of walk(appDir)) {
    const rel = path.relative(appDir, full);
    if (isApiRouteFile(rel)) apiFiles.push(rel);
  }

  if (apiFiles.length === 0) {
    skippedNoApiFiles.push(name);
    continue;
  }

  for (const rel of apiFiles) {
    const text = await fs.readFile(path.join(appDir, rel), "utf8");
    if (!BENCH_CONTRACT_RE.test(text)) {
      violations.push(`${name}/${rel}`);
    } else {
      checked.push(`${name}/${rel}`);
    }
  }
}

if (violations.length) {
  console.error(`test-app-delegation: ${violations.length} api route file(s) bypass @cf-bench/bench-contract:`);
  for (const v of violations) console.error(`  - apps/${v}`);
  console.error(
    "Each api route file must import from @cf-bench/bench-contract (umbrella handleContractApi or per-endpoint helpers handleBench/handleHealth/handleListing/handleListings/handlePrices/handleMedia)."
  );
  process.exit(1);
}

assert.ok(checked.length > 0, "no api route files were inspected — glob is broken");

console.log(
  `test-app-delegation: ${checked.length} api route file(s) verified across ${inScopeNames.length} in-scope frameworks; ${skippedNoApiFiles.length} use central routing (${skippedNoApiFiles.join(", ") || "none"}).`
);
