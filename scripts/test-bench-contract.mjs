#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  HIFI_SUITE_FRAMEWORKS,
  handleBench,
  suiteSupportForFramework,
} from "../packages/bench-contract/src/index.js";

const matrix = JSON.parse(fs.readFileSync("bench/framework-matrix.json", "utf8"));
const matrixHifi = matrix.frameworks
  .filter((framework) => framework.hifi?.enabled === true)
  .map((framework) => framework.name)
  .sort();

assert.deepEqual(
  [...HIFI_SUITE_FRAMEWORKS].sort(),
  matrixHifi,
  "bench-contract hifi suite support list must match matrix hifi.enabled frameworks"
);

assert.deepEqual(suiteSupportForFramework("angular"), ["mpa_airbnb", "spa_trading_media"]);
assert.deepEqual(suiteSupportForFramework("control"), ["mpa_airbnb", "spa_trading_media"]);
assert.deepEqual(suiteSupportForFramework("astro"), [
  "mpa_airbnb",
  "spa_trading_media",
  "mpa_airbnb_hifi",
]);

const angularBench = await handleBench("angular").json();
assert.deepEqual(angularBench.suiteSupport, ["mpa_airbnb", "spa_trading_media"]);

const astroBench = await handleBench("astro").json();
assert.deepEqual(astroBench.suiteSupport, ["mpa_airbnb", "spa_trading_media", "mpa_airbnb_hifi"]);

console.log("bench-contract regression tests passed");
