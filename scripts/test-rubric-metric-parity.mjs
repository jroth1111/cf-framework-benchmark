#!/usr/bin/env node
// Proves that scoring-rubric.json metricWeights keys exactly match the metric
// keys used in bench/src/run.mjs scoreProfilePhaseBucket. A typo in either
// direction silently produces weight-0 scoring (rubric key unused by scoring
// code) or missing scoring dimension (scoring code key absent from rubric).
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Extract metric keys from the scoring code's hard-coded metrics array.
// The array is at bench/src/run.mjs inside scoreProfilePhaseBucket, shaped as:
//   const metrics = [ { key: 'ttfb', ... }, { key: 'lcp', ... }, ... ]
const runSource = await fs.readFile(path.join(repoRoot, "bench", "src", "run.mjs"), "utf8");
const metricKeyRe = /\bkey:\s*'([^']+)'/g;
const scoringMetricKeys = new Set();
for (const match of runSource.matchAll(metricKeyRe)) {
  scoringMetricKeys.add(match[1]);
}
assert.ok(scoringMetricKeys.size >= 7, `expected ≥7 scoring metric keys, got ${scoringMetricKeys.size}`);

// Load the rubric.
const rubric = JSON.parse(
  await fs.readFile(path.join(repoRoot, "bench", "scoring-rubric.json"), "utf8")
);
const rubricMetricKeys = new Set(Object.keys(rubric.metricWeights));
assert.ok(rubricMetricKeys.size >= 7, `expected ≥7 rubric metric keys, got ${rubricMetricKeys.size}`);

// Bidirectional parity: every scoring code key must be in rubric and vice versa.
const missingFromRubric = [...scoringMetricKeys].filter((k) => !rubricMetricKeys.has(k));
assert.deepEqual(
  missingFromRubric,
  [],
  `scoring code metric keys missing from scoring-rubric.json metricWeights (these metrics would score as weight 0):\n${missingFromRubric.join(", ")}`
);

const missingFromScoring = [...rubricMetricKeys].filter((k) => !scoringMetricKeys.has(k));
assert.deepEqual(
  missingFromScoring,
  [],
  `scoring-rubric.json metricWeights keys not used by scoring code (these weights are dead — typos or leftover metrics):\n${missingFromScoring.join(", ")}`
);

// profileMetricWeights keys must also be a subset of the scoring metric keys.
if (rubric.profileMetricWeights) {
  for (const [profile, override] of Object.entries(rubric.profileMetricWeights)) {
    const unknownProfileKeys = Object.keys(override).filter((k) => !scoringMetricKeys.has(k));
    assert.deepEqual(
      unknownProfileKeys,
      [],
      `profileMetricWeights["${profile}"] has keys not in scoring code metrics: ${unknownProfileKeys.join(", ")}`
    );
  }
}

console.log(
  `rubric-metric-parity: ${scoringMetricKeys.size} scoring metric keys == ${rubricMetricKeys.size} rubric metric keys, bidirectional match verified`
);
