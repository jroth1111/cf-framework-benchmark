#!/usr/bin/env node
// Phase E5b proof test 9: assertCanonicalGeography must refuse a canonical
// write when run edge locations do not cover all required regions, and accept
// when they do. Validates the classifier, the enforcement gate, and the
// canonical-geography.json + colo-regions.json catalog pair.
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyGeography, canonicalClass } from "../bench/src/canonical-class.mjs";
import { assertCanonicalGeography } from "../bench/src/run.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// --- probe 1: classifier correctness ---

// MEL only → APAC-only
const melOnly = classifyGeography(["MEL"]);
assert.deepEqual([...melOnly.regions], ["APAC"], "MEL maps to APAC");
assert.equal(melOnly.coverage, "apac-only");
assert.equal(canonicalClass(["MEL"]), "canonical-MEL-only", "single-MEL gets legacy label");

// MEL + IAD (APAC + US)
const melIad = classifyGeography(["MEL", "IAD"]);
assert.ok(melIad.regions.has("APAC"), "MEL → APAC");
assert.ok(melIad.regions.has("US"), "IAD → US");
assert.equal(melIad.coverage, "apac+us");
assert.equal(canonicalClass(["MEL", "IAD"]), "canonical-apac+us");

// MEL + IAD + FRA (global)
const global3 = classifyGeography(["MEL", "IAD", "FRA"]);
assert.ok(global3.regions.has("APAC"));
assert.ok(global3.regions.has("US"));
assert.ok(global3.regions.has("EU"));
assert.equal(global3.coverage, "global");
assert.equal(canonicalClass(["MEL", "IAD", "FRA"]), "canonical");

// No cf-ray headers → no-geo
const noGeo = classifyGeography([]);
assert.equal(noGeo.coverage, "no-geo");
assert.equal(canonicalClass([]), "canonical-no-geo");

// Unknown colo
const withUnknown = classifyGeography(["MEL", "XYZ"]);
assert.ok(withUnknown.unknown.includes("XYZ"), "unknown colos surfaced in .unknown array");
assert.ok(withUnknown.regions.has("APAC"), "known colos still classified");

// --- probe 2: enforcement gate ---

const canonicalPath = path.join(repoRoot, "bench", "results.v4.mpa_airbnb.json");
const nonCanonicalPath = path.join(repoRoot, "bench", "results.v4.mpa_airbnb.dirty.json");

// Non-canonical path → gate is skipped (no throw even with empty locations)
const skipped = assertCanonicalGeography({ outPath: nonCanonicalPath, edgeLocations: [], allowIncompleteGeography: false });
assert.equal(skipped.checked, false, "gate skips non-canonical paths");

// Canonical path with global coverage → accepted
const accepted = assertCanonicalGeography({ outPath: canonicalPath, edgeLocations: ["MEL", "IAD", "FRA"], allowIncompleteGeography: false });
assert.equal(accepted.checked, true);
assert.equal(accepted.missing.length, 0);

// Canonical path with incomplete geography → refused
assert.throws(
  () => assertCanonicalGeography({ outPath: canonicalPath, edgeLocations: ["MEL"], allowIncompleteGeography: false }),
  /Refusing to write canonical results.*geography coverage.*missing regions/s,
  "canonical write refused when geography is incomplete"
);

// Canonical path with incomplete geography + opt-in → allowed (but checked)
const optIn = assertCanonicalGeography({ outPath: canonicalPath, edgeLocations: ["MEL"], allowIncompleteGeography: true });
assert.equal(optIn.checked, true);
assert.ok(optIn.allowedOverride, "allowedOverride is true when opted in with incomplete geography");

// --- probe 3: data files present and well-formed ---
const { default: coloRegions } = await import("../bench/colo-regions.json", { with: { type: "json" } });
assert.ok(typeof coloRegions.regions === "object", "colo-regions.json must have regions object");
assert.ok(Array.isArray(coloRegions.regions.APAC), "APAC region defined");
assert.ok(Array.isArray(coloRegions.regions.US), "US region defined");
assert.ok(Array.isArray(coloRegions.regions.EU), "EU region defined");
assert.ok(coloRegions.regions.APAC.includes("MEL"), "MEL in APAC");
assert.ok(coloRegions.regions.US.includes("IAD"), "IAD in US");
assert.ok(coloRegions.regions.EU.includes("FRA"), "FRA in EU");

const { default: canonGeo } = await import("../bench/canonical-geography.json", { with: { type: "json" } });
assert.ok(Array.isArray(canonGeo.requiredRegions), "canonical-geography.json must have requiredRegions");
assert.deepEqual(canonGeo.requiredRegions, ["APAC", "US", "EU"], "required regions are APAC, US, EU");

console.log("canonical-geography proof OK");
