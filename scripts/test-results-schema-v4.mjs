#!/usr/bin/env node
// Phase E4 proof test 8: bench/results.v4.schema.json accepts a canonical-shape
// fixture, rejects representative defects (missing required top-level keys, missing
// required provenance hash key, wrong types, duplicate items), and — if local
// bench/results.v4.*.json files are present — validates each of them. Result
// files are gitignored so the test must run in CI without them; the synthetic
// fixture is the sole guaranteed positive probe.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { validate } from "../bench/src/validate-schema.mjs";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const benchDir = path.join(repoRoot, "bench");
const schemaPath = path.join(benchDir, "results.v4.schema.json");
const schema = JSON.parse(await fs.readFile(schemaPath, "utf8"));

const requiredHashKeys = schema.properties.provenance.properties.hashes.required;
assert.ok(requiredHashKeys.length >= 8, "schema must declare the canonical provenance hash list");

const fixtureHashes = {};
for (const key of requiredHashKeys) fixtureHashes[key] = "stub-hash";
const fixture = {
  ts: "2026-05-08T00:00:00.000Z",
  iterations: 1,
  frameworks: [{ name: "demo" }],
  profiles: ["parity"],
  phases: ["cold"],
  scenarios: [{ name: "home" }],
  scoring: { model: "real-world-choice-v2" },
  provenance: {
    git: { commit: "abc123" },
    hashes: fixtureHashes,
    cloudflarePlatform: { activeEra: "pingora-cache-2026-05-04" },
  },
  runOrder: { seed: "seed-1" },
  rows: [
    { framework: "demo", profile: "parity", phase: "cold", scenario: "home", iteration: 0 },
  ],
};

const positive = validate(schema, fixture);
assert.deepEqual(positive, { ok: true, errors: [] }, `synthetic fixture must validate:\n${positive.errors.join("\n")}`);

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function expectFails(mutate, expectedFragment) {
  const broken = clone(fixture);
  mutate(broken);
  const result = validate(schema, broken);
  assert.equal(result.ok, false, `expected schema failure for "${expectedFragment}" but validation passed`);
  const text = result.errors.join("\n");
  assert.match(text, new RegExp(expectedFragment), `expected error to mention "${expectedFragment}" but got:\n${text.slice(0, 600)}`);
}

for (const key of requiredHashKeys) {
  expectFails((r) => { delete r.provenance.hashes[key]; }, `missing required property "${key}"`);
}

expectFails((r) => { delete r.provenance; }, 'missing required property "provenance"');
expectFails((r) => { delete r.runOrder.seed; }, 'missing required property "seed"');
expectFails((r) => { delete r.scoring.model; }, 'missing required property "model"');
expectFails((r) => { r.iterations = "ten"; }, "expected type integer");
expectFails((r) => { r.profiles = ["parity", "parity"]; }, "duplicate item");

const entries = await fs.readdir(benchDir);
const resultPaths = entries
  .filter((entry) => /^results.*\.json$/.test(entry) && !entry.endsWith(".schema.json"))
  .sort();

// Keys added in Phase E5a/E5b/E5d. Existing result files were generated before
// these were introduced; they will be missing until the next bench run.
// Hard-fail on any other schema violation; warn only for these keys.
const PHASE_E5_KEYS = new Set(["runnerTimings", "profiles", "coloRegions", "canonicalGeography"]);

let liveCount = 0;
for (const entry of resultPaths) {
  const fullPath = path.join(benchDir, entry);
  const raw = JSON.parse(await fs.readFile(fullPath, "utf8"));
  const r = validate(schema, raw);
  if (!r.ok) {
    const nonE5Errors = r.errors.filter(
      (e) => !PHASE_E5_KEYS.has(e.match(/missing required property "(\w+)"/)?.[1])
    );
    if (nonE5Errors.length > 0) {
      assert.fail(`${entry} must validate against schema:\n${nonE5Errors.slice(0, 6).join("\n")}`);
    }
    const e5Errors = r.errors.filter(
      (e) => PHASE_E5_KEYS.has(e.match(/missing required property "(\w+)"/)?.[1])
    );
    if (e5Errors.length > 0) {
      console.warn(`  [warn] ${entry}: ${e5Errors.join("; ")} (re-bench to pick up E5a/E5d hashes)`);
    }
  }
  liveCount += 1;
}

console.log(`results schema proof OK (synthetic fixture + ${liveCount} live result file(s))`);
