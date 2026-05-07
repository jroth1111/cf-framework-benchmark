#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const rootPackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const benchPackage = JSON.parse(fs.readFileSync("bench/package.json", "utf8"));
const benchmarkWorkflow = fs.readFileSync(".github/workflows/benchmark.yml", "utf8");

assert.match(rootPackage.scripts["bench:hifi"], /--suite mpa_airbnb_hifi/);
assert.match(rootPackage.scripts["bench:all"], /bench:hifi/);
assert.match(benchPackage.scripts["run:hifi"], /--suite mpa_airbnb_hifi/);
assert.match(benchPackage.scripts["run:all"], /run:hifi/);

for (const needle of [
  "verify:live -- --suites mpa_airbnb,spa_trading_media,mpa_airbnb_hifi",
  "--suite mpa_airbnb_hifi",
  "--profile mobile-hifi",
  "--throttle fast-4g",
  "bench/results.v4.mpa_airbnb_hifi.json",
  "bench/results.v4.mpa_airbnb_hifi.md",
  "bench/results.remote.hifi.json",
  "WPT_HIFI_LOCATIONS",
]) {
  assert.ok(benchmarkWorkflow.includes(needle), `benchmark workflow missing ${needle}`);
}

console.log("CI workflow regression tests passed");
