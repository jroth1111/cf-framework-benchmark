#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertCanonicalResultWritable,
  isCanonicalResultPath,
  loadScoringRubric,
  scoringRubricHash,
  suitesHash,
  suitesHashInput,
  provenanceHashForRow,
  benchmarkContractHashInput,
  scenarioContractBucketKey,
  frameworkBucketKey,
} from "../bench/src/run.mjs";
import { defaultOutPathForSuite, runnerPassthroughArgs } from "../bench/src/run-v4.mjs";
import { loadMatrix, loadSuite } from "../bench/src/config-v4.mjs";
import { buildCloudflareAudit } from "./cloudflare-config-audit.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

assert.equal(
  defaultOutPathForSuite("spa_trading_media"),
  path.join(repoRoot, "bench", "results.v4.spa_trading_media.json")
);

// Scoring rubric loader: model literal lives in bench/scoring-rubric.json,
// metricWeights sums to 1.0, scenarioWeights is keyed per-suite with each
// suite's weights summing to 1.0, and the file produces a non-null hash that
// the runner stamps into provenance.hashes.scoring.
{
  const rubric = loadScoringRubric();
  assert.equal(rubric.model, "real-world-choice-v2");
  assert.equal(rubric.prevModel, "real-world-choice-v1");
  const sumMetric = Object.values(rubric.metricWeights).reduce((s, w) => s + Number(w), 0);
  assert.ok(Math.abs(sumMetric - 1) < 1e-6, `metricWeights must sum to 1.0 (got ${sumMetric})`);
  // v2 model: TBT weight is 0; LCP and scriptBoot absorb the freed budget.
  assert.equal(rubric.metricWeights.tbt, 0, "v2 metricWeights.tbt must be 0");
  assert.ok(rubric.metricWeights.lcp >= 0.4, `v2 metricWeights.lcp must absorb TBT (got ${rubric.metricWeights.lcp})`);
  assert.ok(rubric.metricWeights.scriptBoot >= 0.2, `v2 metricWeights.scriptBoot must absorb TBT (got ${rubric.metricWeights.scriptBoot})`);
  const suiteIds = Object.keys(rubric.scenarioWeights);
  assert.ok(suiteIds.length > 0, "scenarioWeights must declare at least one suite");
  for (const suiteId of suiteIds) {
    const weights = rubric.scenarioWeights[suiteId];
    assert.ok(weights && typeof weights === "object" && !Array.isArray(weights), `scenarioWeights["${suiteId}"] must be an object`);
    const sum = Object.values(weights).reduce((s, w) => s + Number(w), 0);
    assert.ok(Math.abs(sum - 1) < 1e-6, `scenarioWeights["${suiteId}"] must sum to 1.0 (got ${sum})`);
  }
  // profileMetricWeights: each profile's override + non-overridden defaults must sum to 1.0.
  if (rubric.profileMetricWeights) {
    for (const [profile, override] of Object.entries(rubric.profileMetricWeights)) {
      const effective = { ...rubric.metricWeights, ...override };
      const sumEffective = Object.values(effective).reduce((s, w) => s + Number(w), 0);
      assert.ok(
        Math.abs(sumEffective - 1) < 1e-6,
        `profileMetricWeights["${profile}"] must sum to 1.0 with non-overridden defaults (got ${sumEffective})`
      );
    }
  }
  const hash = scoringRubricHash();
  assert.ok(typeof hash === "string" && hash.length === 64, `scoringRubricHash must be 64-char sha256 (got ${hash})`);
}

// suites hash: provenance.hashes.suites must (a) cover every JSON file in
// bench/suites/ and (b) change when a suite's waitFor selector changes.
// Mutating the on-disk file then restoring it proves the suites hash flows
// from the file bytes — a stale or hard-coded hash would survive the swap.
{
  const suitesDir = path.join(repoRoot, "bench/suites");
  const entries = (await fs.readdir(suitesDir)).filter((name) => name.endsWith(".json")).sort();
  const input = suitesHashInput();
  assert.deepEqual(Object.keys(input).sort(), entries, "suitesHashInput must cover every bench/suites/*.json file");
  const baseline = suitesHash();

  const target = path.join(suitesDir, entries[0]);
  const original = await fs.readFile(target, "utf8");
  const mutated = original.replace(/"waitFor":\s*"([^"]+)"/, '"waitFor": "$1__hash_test"');
  assert.notEqual(mutated, original, "suite mutation probe must alter waitFor selector text");
  await fs.writeFile(target, mutated, "utf8");
  try {
    const mutatedHash = suitesHash();
    assert.notEqual(mutatedHash, baseline, "suites hash must change when a waitFor selector changes");
  } finally {
    await fs.writeFile(target, original, "utf8");
  }
  assert.equal(suitesHash(), baseline, "suites hash must restore to baseline after the suite file is restored");
}

// run.mjs must reference the model literals only via the loader path; the
// score model name lives exclusively in bench/scoring-rubric.json.
{
  const runMjs = await fs.readFile(path.join(repoRoot, "bench/src/run.mjs"), "utf8");
  for (const literal of ["real-world-choice-v1", "real-world-choice-v2"]) {
    const occurrences = (runMjs.match(new RegExp(literal, "g")) || []).length;
    assert.equal(
      occurrences,
      0,
      `bench/src/run.mjs must not contain the scoring model literal "${literal}" directly; the loader reads bench/scoring-rubric.json. Found ${occurrences}.`
    );
  }
}

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
  const audit = await buildCloudflareAudit({ cwd: repoRoot });
  const cloudflareByName = new Map(audit.frameworks.map((row) => [row.name, row]));
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
        const cloudflareMode = cloudflareByName.get(fw.name)?.wrangler?.assetRouting?.mode;
        assert.ok(
          cloudflareMode,
          `cloudflare audit row missing assetRouting.mode for enabled framework=${fw.name} — wrangler config gap`
        );
        const bucketKey = scenarioContractBucketKey({
          delivery: "workers",
          implementationKind: fw.implementationKind || "native",
          tier: fw.tier || "unknown",
          cloudflareMode,
          scenario: sc.name,
          contract,
        });
        const expected = `delivery=workers::impl=${fw.implementationKind || "native"}::tier=${fw.tier || "unknown"}::cf=${cloudflareMode}::scenario=${sc.name}::render=${contract.renderMode}::data=${contract.initialData}::hydration=${contract.hydrationModel}`;
        assert.equal(bucketKey, expected, `bucket key drift for ${fw.name}/${suiteId}/${sc.name}`);
        probes += 1;
      }
    }
  }
  assert.ok(probes > 0, "bucket-key invariance probe ran zero triples");
  console.log(`bucket-key invariance verified across ${probes} (framework × suite × scenario) triples`);
}

// Strict cloudflare audit: bucket-key builders refuse to emit cf=unknown.
// Without this, a missing wrangler.jsonc silently disqualifies a framework
// from its scoring bucket and the bench keeps running. Probe each failure
// mode (no audit row / wrangler unparsed / unknown literal / falsy) so a
// regression is caught at unit-test time, not by visual inspection of a
// canonical result file.
{
  assert.throws(
    () => scenarioContractBucketKey({
      delivery: "workers",
      implementationKind: "native",
      tier: "framework-runtime",
      cloudflareMode: "unknown",
      scenario: "stays",
      contract: { renderMode: "ssr", initialData: "document", hydrationModel: "framework" },
    }),
    /cloudflareMode is required/,
    "scenarioContractBucketKey must throw when cloudflareMode === 'unknown'"
  );
  assert.throws(
    () => scenarioContractBucketKey({
      delivery: "workers",
      implementationKind: "native",
      tier: "framework-runtime",
      cloudflareMode: null,
      scenario: "stays",
      contract: { renderMode: "ssr", initialData: "document", hydrationModel: "framework" },
    }),
    /cloudflareMode is required/,
    "scenarioContractBucketKey must throw when cloudflareMode is null"
  );
  assert.throws(
    () => scenarioContractBucketKey({
      delivery: "workers",
      implementationKind: "native",
      tier: "framework-runtime",
      cloudflareMode: "",
      scenario: "stays",
      contract: { renderMode: "ssr", initialData: "document", hydrationModel: "framework" },
    }),
    /cloudflareMode is required/,
    "scenarioContractBucketKey must throw when cloudflareMode is empty string"
  );

  const noAuditMeta = {
    name: "phantom",
    delivery: "workers",
    implementationKind: "native",
    tier: "framework-runtime",
    cloudflare: null,
    scenarioContracts: { home: { renderMode: "ssr", initialData: "document", hydrationModel: "framework" } },
  };
  assert.throws(
    () => frameworkBucketKey(noAuditMeta, ["home"]),
    /no cloudflare audit row/,
    "frameworkBucketKey must throw when meta.cloudflare is missing"
  );

  const noWranglerMeta = {
    name: "phantom",
    delivery: "workers",
    implementationKind: "native",
    tier: "framework-runtime",
    cloudflare: { wrangler: null },
    scenarioContracts: { home: { renderMode: "ssr", initialData: "document", hydrationModel: "framework" } },
  };
  assert.throws(
    () => frameworkBucketKey(noWranglerMeta, ["home"]),
    /no wrangler config parsed/,
    "frameworkBucketKey must throw when meta.cloudflare.wrangler is missing"
  );

  const noModeMeta = {
    name: "phantom",
    delivery: "workers",
    implementationKind: "native",
    tier: "framework-runtime",
    cloudflare: { wrangler: { assetRouting: {} } },
    scenarioContracts: { home: { renderMode: "ssr", initialData: "document", hydrationModel: "framework" } },
  };
  assert.throws(
    () => frameworkBucketKey(noModeMeta, ["home"]),
    /wrangler\.assetRouting\.mode is unset/,
    "frameworkBucketKey must throw when meta.cloudflare.wrangler.assetRouting.mode is unset"
  );

  // Sanity: the strict path still produces a key when the audit row is real.
  const goodMeta = {
    name: "phantom",
    delivery: "workers",
    implementationKind: "native",
    tier: "framework-runtime",
    cloudflare: { wrangler: { assetRouting: { mode: "worker-only" } } },
    scenarioContracts: { home: { renderMode: "ssr", initialData: "document", hydrationModel: "framework" } },
  };
  const goodKey = frameworkBucketKey(goodMeta, ["home"]);
  assert.ok(/cf=worker-only/.test(goodKey), `frameworkBucketKey must include cf=worker-only when meta is valid; got ${goodKey}`);
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

assert.equal(
  typeof benchmarkContractHashInput().contracts.contractSchema,
  "string",
  "benchmark provenance contract hash must include contracts/v5.schema.json (E4)"
);

assert.equal(
  typeof benchmarkContractHashInput().contracts.resultsSchema,
  "string",
  "benchmark provenance contract hash must include bench/results.v4.schema.json (E4)"
);

assert.equal(
  typeof benchmarkContractHashInput().contracts.runnerTimings,
  "string",
  "benchmark provenance contract hash must include bench/runner-timings.json (E5d)"
);

assert.equal(
  typeof benchmarkContractHashInput().contracts.profiles,
  "string",
  "benchmark provenance contract hash must include bench/profiles.json (E5a)"
);

assert.equal(
  typeof benchmarkContractHashInput().contracts.coloRegions,
  "string",
  "benchmark provenance contract hash must include bench/colo-regions.json (E5b)"
);

assert.equal(
  typeof benchmarkContractHashInput().contracts.canonicalGeography,
  "string",
  "benchmark provenance contract hash must include bench/canonical-geography.json (E5b)"
);

assert.equal(isCanonicalResultPath("bench/results.v4.mpa_airbnb.json"), true);
assert.equal(isCanonicalResultPath("bench/results.v4.mpa_airbnb.dirty.json"), false);
assert.equal(isCanonicalResultPath("bench/results.v4.mpa_airbnb.regional.json"), false);
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

// isRetryableNavError regex: must match http_5xx status codes.
// The regex in run.mjs is /^http_(408|429|5\d\d)$/ — this test ensures
// the character class is a real \d (matches digits), not an escaped \\d
// (matches literal backslash+d, which never matches any HTTP status).
{
  const retryablePattern = /^http_(408|429|5\d\d)$/;
  // 5xx statuses must match
  for (const status of [500, 502, 503, 504, 599]) {
    const msg = `http_${status}`;
    assert.ok(retryablePattern.test(msg), `http_${status} must be retryable`);
  }
  // 408 and 429 must match
  assert.ok(retryablePattern.test("http_408"), "http_408 must be retryable");
  assert.ok(retryablePattern.test("http_429"), "http_429 must be retryable");
  // non-retryable statuses must not match
  for (const status of [200, 301, 400, 401, 403, 404]) {
    const msg = `http_${status}`;
    assert.ok(!retryablePattern.test(msg), `http_${status} must NOT be retryable`);
  }
}

console.log("bench runner regression tests passed");
