#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fallbackScenarioContractForType } from "../bench/src/run.mjs";
import { defaultOutPathForSuite, defaultScenarioContract } from "../bench/src/run-v4.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

assert.deepEqual(
  fallbackScenarioContractForType("spa"),
  defaultScenarioContract({ type: "spa" })
);

assert.deepEqual(fallbackScenarioContractForType("document"), {
  renderMode: "ssr",
  initialData: "document",
  hydrationModel: "framework",
});

assert.equal(
  defaultOutPathForSuite("spa_trading_media"),
  path.join(repoRoot, "bench", "results.v4.spa_trading_media.json")
);

console.log("bench runner regression tests passed");
