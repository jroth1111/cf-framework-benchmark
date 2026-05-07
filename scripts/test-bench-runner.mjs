#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertCanonicalResultWritable,
  fallbackScenarioContractForType,
  isCanonicalResultPath,
  provenanceHashForRow,
  benchmarkContractHashInput,
  scenarioContractBucketKey,
} from "../bench/src/run.mjs";
import { defaultOutPathForSuite, defaultScenarioContract, runnerPassthroughArgs } from "../bench/src/run-v4.mjs";

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

assert.deepEqual(
  runnerPassthroughArgs([
    "node",
    "run-v4.mjs",
    "--suite",
    "mpa_airbnb_hifi",
    "--profile",
    "mobile-hifi",
    "--realdevice",
    "browserstack:iphone-13",
    "--flamegraphs",
    "--flamegraph-dir",
    "bench/flamegraphs/test",
  ]),
  [
    "--flamegraphs",
    "--profile",
    "mobile-hifi",
    "--realdevice",
    "browserstack:iphone-13",
    "--flamegraph-dir",
    "bench/flamegraphs/test",
  ],
  "run-v4 must forward documented runner flags to run.mjs"
);

assert.equal(
  runnerPassthroughArgs(["node", "run-v4.mjs", "--suite", "mpa_airbnb_hifi"]).includes("--realdevice"),
  false,
  "run-v4 must not synthesize real-device mode unless explicitly requested"
);

assert.equal(
  typeof benchmarkContractHashInput().contracts.v5,
  "string",
  "benchmark provenance contract hash must include the v5 contract"
);

assert.equal(
  typeof benchmarkContractHashInput().contracts.v6Addendum,
  "string",
  "benchmark provenance contract hash must include the v6 hifi addendum"
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
    cloudflareMode: "worker-only",
    scenario: "stays",
    contract: {
      renderMode: "ssr",
      initialData: "document",
      hydrationModel: "framework",
    },
  }),
  "delivery=workers::impl=native::tier=framework-runtime::cf=worker-only::scenario=stays::render=ssr::data=document::hydration=framework"
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

assert.notEqual(
  provenanceHashForRow(
    {
      framework: "demo",
      profile: "parity",
      phase: "cold",
      scenario: "home",
      iteration: 1,
      ok: true,
      status: 200,
      trace: { cfRay: "abc-MEL", colo: "MEL", cacheStatus: "MISS" },
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
      trace: { cfRay: "def-SYD", colo: "SYD", cacheStatus: "HIT" },
      serverMetrics: { ttfb: 10 },
      synthetic: { nav: { ttfb: 10 } },
    },
    { commit: "abc123" },
    "seed"
  ),
  "row provenance hash should include Cloudflare trace metadata"
);

assert.notEqual(
  provenanceHashForRow(
    {
      framework: "demo",
      profile: "parity",
      phase: "cold",
      scenario: "home",
      iteration: 1,
      ok: true,
      status: 200,
      headers: { link: "</asset.css>; rel=preload; as=style" },
      earlyHints: [{ status: 103, link: "</asset.css>; rel=preload; as=style" }],
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
      headers: {},
      earlyHints: [],
      serverMetrics: { ttfb: 10 },
      synthetic: { nav: { ttfb: 10 } },
    },
    { commit: "abc123" },
    "seed"
  ),
  "row provenance hash should include Link and HTTP 103 Early Hints evidence"
);

console.log("bench runner regression tests passed");
