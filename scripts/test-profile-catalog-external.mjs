#!/usr/bin/env node
// Phase E5a proof test 7: bench/src/run.mjs must not contain inline parity/idiomatic
// profile default literals — these must be loaded from bench/profiles.json.
// Also validates that profiles.json has the canonical headerName and validValues,
// and that bench-cache derives its HTML cache-policy set from the catalog.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

// --- probe 1: run.mjs has no inline profile default object ---
const runMjsPath = path.join(repoRoot, "bench", "src", "run.mjs");
const runSource = await fs.readFile(runMjsPath, "utf8");

// The forbidden pattern: hardcoded per-profile chartCache defaults inside a const literal.
// Allowed forms are lines that load from profilesCatalog (pass-through code path).
const inlineProfileDefault = /parity\s*:\s*\{\s*chartCache/;
assert.ok(
  !inlineProfileDefault.test(runSource),
  'bench/src/run.mjs must not contain inline "parity: { chartCache" default — load from bench/profiles.json'
);

const inlineIdiomaticDefault = /idiomatic\s*:\s*\{\s*chartCache/;
assert.ok(
  !inlineIdiomaticDefault.test(runSource),
  'bench/src/run.mjs must not contain inline "idiomatic: { chartCache" default — load from bench/profiles.json'
);

// The catalog import must be present.
assert.match(
  runSource,
  /import profilesCatalog from ['"]\.\.\/profiles\.json['"]/,
  "bench/src/run.mjs must import profilesCatalog from '../profiles.json'"
);

// --- probe 2: profiles.json structure ---
const catalogPath = path.join(repoRoot, "bench", "profiles.json");
const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));

assert.ok(typeof catalog.headerName === "string" && catalog.headerName.length > 0, "profiles.json must declare headerName");
assert.ok(Array.isArray(catalog.validValues) && catalog.validValues.length > 0, "profiles.json must declare validValues");
assert.ok(Array.isArray(catalog.profiles) && catalog.profiles.length > 0, "profiles.json must declare profiles array");

for (const profile of catalog.profiles) {
  assert.ok(typeof profile.id === "string", `profile.id must be a string (got ${JSON.stringify(profile)})`);
  assert.ok("chartCache" in profile, `profile ${profile.id} must declare chartCache`);
  assert.ok("htmlCachePolicy" in profile, `profile ${profile.id} must declare htmlCachePolicy`);
  assert.ok(
    profile.htmlCachePolicy === "preserve" || profile.htmlCachePolicy === "downgrade-non-hifi",
    `profile ${profile.id} htmlCachePolicy must be "preserve" or "downgrade-non-hifi"`
  );
}

// validValues must cover every profile id.
const profileIds = new Set(catalog.profiles.map((p) => p.id));
for (const v of catalog.validValues) {
  assert.ok(profileIds.has(v), `validValues entry "${v}" has no matching profile in profiles array`);
}

// --- probe 3: bench-cache derives preserve-set from catalog, not inline literal ---
const benchCachePath = path.join(repoRoot, "packages", "bench-cache", "src", "index.js");
const cacheSource = await fs.readFile(benchCachePath, "utf8");

assert.ok(
  !/"idiomatic"\s*,\s*"mobile-cold"/.test(cacheSource) && !/"mobile-cold"\s*,\s*"idiomatic"/.test(cacheSource),
  'packages/bench-cache/src/index.js must not hardcode ["idiomatic", "mobile-cold"] — derive from bench/profiles.json'
);
assert.match(
  cacheSource,
  /import profilesCatalog from ['"]\.\.\/\.\.\/\.\.\/bench\/profiles\.json['"]/,
  "packages/bench-cache/src/index.js must import profilesCatalog from bench/profiles.json"
);

// Derive the expected preserve set from the catalog and verify it contains
// idiomatic and mobile-cold (regression guard).
const expectedPreserve = new Set(
  catalog.profiles.filter((p) => p.htmlCachePolicy === "preserve").map((p) => p.id)
);
assert.ok(expectedPreserve.has("idiomatic"), "idiomatic profile must have htmlCachePolicy: preserve");
assert.ok(expectedPreserve.has("mobile-cold"), "mobile-cold profile must have htmlCachePolicy: preserve");
assert.ok(!expectedPreserve.has("parity"), "parity profile must have htmlCachePolicy: downgrade-non-hifi, not preserve");

console.log(`profile-catalog-external proof OK (${catalog.profiles.length} profiles, headerName="${catalog.headerName}")`);
