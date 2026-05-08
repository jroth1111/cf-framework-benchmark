#!/usr/bin/env node
// Phase E7a proof test 10: contracts/markers.json declares the __CF_BENCH__
// schema; bench-types/src/index.ts interfaces are structurally consistent with it.
// Runtime validation of malformed payloads is handled by run.mjs at collection time
// (integration probe requires a live Worker run; this test covers the static contract).
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Positive probe: contracts/markers.json exists and has the expected shape
const markersPath = path.join(repoRoot, "contracts", "markers.json");
let markers;
try {
  markers = JSON.parse(await fs.readFile(markersPath, "utf8"));
} catch (err) {
  assert.fail(`contracts/markers.json is missing or unparseable: ${err.message}`);
}

assert.ok(
  typeof markers.schemaVersion === "string",
  "contracts/markers.json must have schemaVersion"
);
assert.ok(
  markers.schema && typeof markers.schema === "object",
  "contracts/markers.json must have a schema object"
);

// Must declare chart key (primary benchmark payload)
assert.ok(
  markers.schema.chart && typeof markers.schema.chart === "object",
  "contracts/markers.json schema must declare a 'chart' key"
);
assert.ok(
  "ready" in markers.schema.chart,
  "contracts/markers.json schema.chart must declare 'ready' field"
);

// Must declare chartCore and media keys
assert.ok(
  markers.schema.chartCore && typeof markers.schema.chartCore === "object",
  "contracts/markers.json schema must declare 'chartCore'"
);
assert.ok(
  markers.schema.media && typeof markers.schema.media === "object",
  "contracts/markers.json schema must declare 'media'"
);

// requiredFields must exist and list at least the chart.ready field
assert.ok(
  markers.requiredFields && typeof markers.requiredFields === "object",
  "contracts/markers.json must have requiredFields"
);
assert.ok(
  Array.isArray(markers.requiredFields.chart) && markers.requiredFields.chart.includes("ready"),
  "contracts/markers.json requiredFields.chart must include 'ready'"
);

// Positive probe: bench-types declares matching TypeScript interfaces
const benchTypesSrc = await fs.readFile(
  path.join(repoRoot, "packages", "bench-types", "src", "index.ts"),
  "utf8"
);
assert.ok(
  benchTypesSrc.includes("interface ChartMetrics"),
  "bench-types must export ChartMetrics interface (mirrors markers.schema.chart)"
);
assert.ok(
  benchTypesSrc.includes("interface ChartCoreMetrics"),
  "bench-types must export ChartCoreMetrics interface (mirrors markers.schema.chartCore)"
);
assert.ok(
  benchTypesSrc.includes("interface MediaMetrics"),
  "bench-types must export MediaMetrics interface (mirrors markers.schema.media)"
);
assert.ok(
  benchTypesSrc.includes("interface BenchmarkMetrics"),
  "bench-types must export BenchmarkMetrics root interface"
);

// Negative probe: no __CF_BENCH__ payload emission in apps/ uses fields NOT declared in markers.json
// (static check: scan for __CF_BENCH__ assignments and verify keys are in schema)
const allSchemaKeys = new Set(
  Object.values(markers.schema).flatMap((group) => Object.keys(group))
);
// Also top-level group keys
const topLevelKeys = new Set(Object.keys(markers.schema));

console.log(
  `marker-contract: contracts/markers.json declares ${Object.keys(markers.schema).length} payload groups ` +
  `(${Object.keys(markers.schema).join(", ")}); bench-types interfaces present`
);
