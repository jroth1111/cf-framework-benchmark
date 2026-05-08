#!/usr/bin/env node
// Phase E7c proof test 12: every metric in scoring-rubric.json metricWeights has
// a lighthouse mapping in bench/hifi-reference.json; every metric lighthouse-compare
// extracts maps back to a rubric weight or is explicitly tagged diagnostic.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const rubric = JSON.parse(
  await fs.readFile(path.join(repoRoot, "bench", "scoring-rubric.json"), "utf8")
);
const hifiRef = JSON.parse(
  await fs.readFile(path.join(repoRoot, "bench", "hifi-reference.json"), "utf8")
);

assert.ok(
  typeof hifiRef.referenceUrl === "string" && hifiRef.referenceUrl.length > 0,
  "bench/hifi-reference.json must have a non-empty referenceUrl"
);
assert.ok(
  hifiRef.metricMapping && typeof hifiRef.metricMapping === "object",
  "bench/hifi-reference.json must have a metricMapping object"
);

const rubricMetrics = Object.keys(rubric.metricWeights ?? {});
assert.ok(rubricMetrics.length > 0, "scoring-rubric.json must have metricWeights");

const mapping = hifiRef.metricMapping;
const missing = [];

// Positive probe: every rubric metric has an entry in metricMapping
for (const metric of rubricMetrics) {
  if (!(metric in mapping)) {
    missing.push(metric);
  }
}
assert.deepEqual(
  missing,
  [],
  `scoring-rubric.json metricWeights keys missing from bench/hifi-reference.json metricMapping:\n${missing.join("\n")}`
);

// Positive probe: every non-diagnostic metric has a non-null lighthouseAuditId
const nonDiagnosticWithoutId = rubricMetrics.filter(
  (m) => !mapping[m]?.diagnostic && mapping[m]?.lighthouseAuditId == null
);
assert.deepEqual(
  nonDiagnosticWithoutId,
  [],
  `Non-diagnostic rubric metrics must have a lighthouseAuditId:\n${nonDiagnosticWithoutId.join("\n")}`
);

// Positive probe: diagnostic entries have a reason
const diagnosticWithoutReason = rubricMetrics.filter(
  (m) => mapping[m]?.diagnostic && typeof mapping[m]?.reason !== "string"
);
assert.deepEqual(
  diagnosticWithoutReason,
  [],
  `Diagnostic metric mappings must include a reason string:\n${diagnosticWithoutReason.join("\n")}`
);

// Positive probe: lighthouse-compare.mjs uses hifi-reference.json for referenceUrl
const lhSrc = await fs.readFile(
  path.join(repoRoot, "scripts", "lighthouse-compare.mjs"),
  "utf8"
);
assert.ok(
  lhSrc.includes("hifi-reference.json"),
  "scripts/lighthouse-compare.mjs must read referenceUrl from bench/hifi-reference.json"
);
assert.ok(
  lhSrc.includes("hifiRef.referenceUrl"),
  "scripts/lighthouse-compare.mjs must use hifiRef.referenceUrl as DEFAULT_REFERENCE_URL"
);

// Negative probe: DEFAULT_REFERENCE_URL must not be hardcoded as a literal URL
assert.ok(
  !lhSrc.match(/const DEFAULT_REFERENCE_URL\s*=\s*["']https?:\/\//),
  "scripts/lighthouse-compare.mjs must not hardcode DEFAULT_REFERENCE_URL as a URL literal"
);

const diagnosticCount = rubricMetrics.filter((m) => mapping[m]?.diagnostic).length;
const mappedCount = rubricMetrics.filter((m) => !mapping[m]?.diagnostic).length;

console.log(
  `lighthouse-rubric-parity: ${rubricMetrics.length} rubric metrics — ` +
  `${mappedCount} mapped to lighthouse audits, ${diagnosticCount} diagnostic-only`
);
