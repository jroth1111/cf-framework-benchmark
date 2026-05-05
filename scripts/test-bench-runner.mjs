#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertCanonicalResultWritable,
  fallbackScenarioContractForType,
  isCanonicalResultPath,
  provenanceHashForRow,
  scenarioContractBucketKey,
} from "../bench/src/run.mjs";
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

assert.equal(isCanonicalResultPath("bench/results.v4.mpa_airbnb.json"), true);
assert.equal(isCanonicalResultPath("bench/results.v4.mpa_airbnb.dirty.json"), false);
assert.equal(isCanonicalResultPath("bench/results.v4.spa_trading_media.smoke.json"), false);

assert.throws(
  () =>
    assertCanonicalResultWritable({
      outPath: "bench/results.v4.mpa_airbnb.json",
      gitInfo: { dirty: true },
    }),
  /Refusing to write canonical results/
);

assert.deepEqual(
  assertCanonicalResultWritable({
    outPath: "bench/results.v4.mpa_airbnb.dirty.json",
    gitInfo: { dirty: true },
  }),
  { canonical: false, dirty: true, dirtyCanonicalOverride: false }
);

assert.deepEqual(
  assertCanonicalResultWritable({
    outPath: "bench/results.v4.mpa_airbnb.json",
    gitInfo: { dirty: true },
    allowDirtyProvenance: true,
  }),
  { canonical: true, dirty: true, dirtyCanonicalOverride: true }
);

assert.equal(
  scenarioContractBucketKey({
    delivery: "workers",
    implementationKind: "native",
    tier: "framework-runtime",
    scenario: "stays",
    contract: {
      renderMode: "ssr",
      initialData: "document",
      hydrationModel: "framework",
    },
  }),
  "delivery=workers::impl=native::tier=framework-runtime::scenario=stays::render=ssr::data=document::hydration=framework"
);

assert.equal(
  provenanceHashForRow(
    {
      framework: "demo",
      profile: "parity",
      phase: "cold",
      scenario: "home",
      iteration: 1,
      ok: true,
      status: 200,
      serverMetrics: { ttfb: 10 },
      synthetic: { nav: { ttfb: 10 } },
    },
    { commit: "abc123" },
    "seed"
  ),
  provenanceHashForRow(
    {
      framework: "demo",
      profile: "parity",
      phase: "cold",
      scenario: "home",
      iteration: 1,
      ok: true,
      status: 200,
      serverMetrics: { ttfb: 10 },
      synthetic: { nav: { ttfb: 10 } },
    },
    { commit: "abc123" },
    "seed"
  )
);

console.log("bench runner regression tests passed");
