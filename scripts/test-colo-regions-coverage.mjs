#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const benchDir = path.join(repoRoot, "bench");
const coloRegionsPath = path.join(benchDir, "colo-regions.json");
const failOnUnknown = process.argv.includes("--fail-on-unknown");

// Step 1: Read colo-regions.json and build a Set of all known colos
const coloRegionsRaw = await fs.readFile(coloRegionsPath, "utf8");
const coloRegions = JSON.parse(coloRegionsRaw);

const requiredRegionKeys = ["APAC", "US", "EU"];
for (const key of requiredRegionKeys) {
  assert(
    Array.isArray(coloRegions.regions?.[key]) && coloRegions.regions[key].length > 0,
    `colo-regions.json must have region "${key}" with at least one colo code`
  );
}

const knownColos = new Set();
for (const colos of Object.values(coloRegions.regions)) {
  for (const colo of colos) {
    knownColos.add(colo);
  }
}

// Step 2: Read all bench/results.v4.*.json files
const entries = await fs.readdir(benchDir);
const resultFiles = entries.filter(
  (name) => /^results\.v4\..+\.json$/.test(name)
);

const unknownByFile = new Map();
for (const filename of resultFiles) {
  const filePath = path.join(benchDir, filename);
  const raw = await fs.readFile(filePath, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    // Skip unparseable files silently
    continue;
  }

  const unknown = data?.result?.canonical?.unknown;
  if (Array.isArray(unknown) && unknown.length > 0) {
    unknownByFile.set(filename, unknown);
  }
}

// Step 3: Report unknown colos
let totalUnknown = 0;
if (unknownByFile.size > 0) {
  console.warn("WARNING: Unknown colos observed in result files (not mapped in colo-regions.json):");
  for (const [filename, colos] of unknownByFile) {
    console.warn(`  ${filename}: ${colos.join(", ")}`);
    totalUnknown += colos.length;
  }

  if (failOnUnknown) {
    assert.fail(
      `${totalUnknown} unknown colo(s) found across ${unknownByFile.size} result file(s). Add them to bench/colo-regions.json.`
    );
  }
}

// Step 5: Print success summary
console.log(
  `colo-regions-coverage: ${knownColos.size} known colos across APAC/US/EU; ${resultFiles.length} result files checked; ${totalUnknown} unknown colos observed`
);
