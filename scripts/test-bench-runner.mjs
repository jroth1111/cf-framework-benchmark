#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertCanonicalResultWritable,
  isCanonicalResultPath,
  provenanceHashForRow,
  benchmarkContractHashInput,
  scenarioContractBucketKey,
} from "../bench/src/run.mjs";
import { defaultOutPathForSuite, runnerPassthroughArgs } from "../bench/src/run-v4.mjs";
import { loadMatrix, loadSuite } from "../bench/src/config-v4.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

assert.equal(
  defaultOutPathForSuite("spa_trading_media"),
  path.join(repoRoot, "bench", "results.v4.spa_trading_media.json")
);

// Bucket-key invariance: every (framework × suite × scenario) triple in the matrix
// must produce a stable bucket key under the contract resolved from
// benchmarkDefaults.scenarioContracts (single source of authority — no runtime
// fallback). Captures the contract values that bench/results.v4.*.json bucket
// scoreboards group on; if a triple lacks an explicit contract, the matrix is
// the wrong place to look first.
{
  const matrix = await loadMatrix(path.join(repoRoot, "bench", "framework-matrix.json"));
  const suiteIds = ["mpa_airbnb", "spa_trading_media", "mpa_airbnb_hifi"];
  const enabled = matrix.frameworks.filter((fw) => fw.benchmarkEnabled);
  let probes = 0;
  for (const suiteId of suiteIds) {
    const suite = await loadSuite(suiteId, path.join(repoRoot, "bench", "suites"));
    for (const fw of enabled) {
      for (const sc of suite.scenarios) {
        const contract = fw.scenarioContracts?.[suiteId]?.[sc.name];
        assert.ok(
          contract && contract.renderMode && contract.initialData && contract.hydrationModel,
          `matrix lacks scenarioContract for framework=${fw.name} suite=${suiteId} scenario=${sc.name}`
        );
        const bucketKey = scenarioContractBucketKey({
          delivery: "workers",
          implementationKind: fw.implementationKind || "native",
          tier: fw.tier || "unknown",
          cloudflareMode: fw?.cloudflare?.wrangler?.assetRouting?.mode || "unknown",
          scenario: sc.name,
          contract,
        });
        const expected = `delivery=workers::impl=${fw.implementationKind || "native"}::tier=${fw.tier || "unknown"}::cf=${fw?.cloudflare?.wrangler?.assetRouting?.mode || "unknown"}::scenario=${sc.name}::render=${contract.renderMode}::data=${contract.initialData}::hydration=${contract.hydrationModel}`;
        assert.equal(bucketKey, expected, `bucket key drift for ${fw.name}/${suiteId}/${sc.name}`);
        probes += 1;
      }
    }
  }
  assert.ok(probes > 0, "bucket-key invariance probe ran zero triples");
  console.log(`bucket-key invariance verified across ${probes} (framework × suite × scenario) triples`);
}

// run.mjs must throw if the bench config does not declare scenarios — the
// runner no longer ships DEFAULT_SCENARIOS; suite-defined scenarios are the
// single source of authority.
{
  const tmpDir = await fs.mkdtemp(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".tmp-test-bench-runner-"));
  try {
    const cfgPath = path.join(tmpDir, "no-scenarios.json");
    await fs.writeFile(cfgPath, JSON.stringify({ frameworks: [] }), "utf8");
    const child = await import("node:child_process");
    const res = child.spawnSync(process.execPath, ["bench/src/run.mjs", "--config", cfgPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    assert.notEqual(res.status, 0, "run.mjs must exit non-zero when scenarios are missing");
    const combined = `${res.stdout || ""}\n${res.stderr || ""}`;
    assert.ok(
      /must declare a non-empty scenarios array/.test(combined),
      `run.mjs must error with scenarios-missing message; got: ${combined.slice(0, 600)}`
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

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
