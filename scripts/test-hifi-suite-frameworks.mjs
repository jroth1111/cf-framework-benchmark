#!/usr/bin/env node
import assert from "node:assert/strict";
import { computeHifiSuiteFrameworks } from "./generate-hifi-suite-frameworks.mjs";
import { HIFI_SUITE_FRAMEWORKS } from "../packages/bench-contract/src/hifi-suite-frameworks.generated.js";
import {
  handleBench,
  suiteSupportForFramework,
} from "../packages/bench-contract/src/index.js";

const expected = await computeHifiSuiteFrameworks();
assert.deepEqual(
  [...HIFI_SUITE_FRAMEWORKS],
  expected,
  "generated HIFI_SUITE_FRAMEWORKS must match frameworks[].hifi.enabled in bench/framework-matrix.json. Run: pnpm build:hifi-frameworks"
);

assert.equal(Object.isFrozen(HIFI_SUITE_FRAMEWORKS), true, "HIFI_SUITE_FRAMEWORKS must be frozen");

const badInputs = ["", "   ", null, undefined, 0, 1, false, true, {}, []];
for (const value of badInputs) {
  assert.throws(
    () => suiteSupportForFramework(value),
    /must be a non-empty string/,
    `suiteSupportForFramework should throw on ${JSON.stringify(value) ?? String(value)}`
  );
  assert.throws(
    () => handleBench(value),
    /must be a non-empty string/,
    `handleBench should throw on ${JSON.stringify(value) ?? String(value)}`
  );
}

assert.deepEqual(suiteSupportForFramework("react"), [
  "mpa_airbnb",
  "spa_trading_media",
  "mpa_airbnb_hifi",
]);
assert.deepEqual(suiteSupportForFramework("React"), [
  "mpa_airbnb",
  "spa_trading_media",
  "mpa_airbnb_hifi",
]);
assert.deepEqual(suiteSupportForFramework("analog"), ["mpa_airbnb", "spa_trading_media"]);

console.log(`hifi-suite-frameworks regression tests passed (${expected.length} frameworks).`);
