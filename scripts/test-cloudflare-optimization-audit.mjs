#!/usr/bin/env node
import assert from "node:assert/strict";
import { buildOptimizationAudit } from "./cloudflare-optimization-audit.mjs";

const report = await buildOptimizationAudit();

assert.equal(report.ok, true, "optimization audit should not have required metadata gaps");
assert.equal(report.gaps.length, 0, "enabled benchmark apps should have complete optimization audit inputs");
assert.ok(report.sourceRequirements.includes("cloudflare/workers-sdk#7344"));
assert.ok(report.sourceRequirements.includes("TanStack/router#6400"));
assert.deepEqual(report.riskCounts, {}, "source-level optimization risks should be resolved or classified as disclosures");
for (const requiredClass of [
  "static-cache-contract",
  "asset-routing-experiment",
  "smart-placement-service-binding",
  "opennext-cache-mode",
  "workerd-local-harness",
  "trace-correlation",
  "platform-era-disclosure",
  "early-hints-link-evidence",
  "tanstack-prerender-mode",
  "vinext-diagnostic",
]) {
  assert.ok(
    report.optimizationVariants.requiredClasses.includes(requiredClass),
    `optimization variants should require ${requiredClass}`
  );
  assert.ok(report.optimizationVariants.classCounts[requiredClass] > 0, `optimization variants should define ${requiredClass}`);
}
assert.equal(
  report.optimizationVariants.variants.find((variant) => variant.id === "vinext-diagnostic-comparator")?.ranking,
  "excluded",
  "Vinext diagnostic comparator must stay excluded from ranking"
);
assert.ok(report.traceCorrelation.capturedHeaders.includes("cf-ray"));
assert.ok(report.traceCorrelation.capturedHeaders.includes("link"));
assert.ok(report.traceCorrelation.derivedFields.includes("colo"));
assert.ok(report.traceCorrelation.derivedFields.includes("linkHeader"));
assert.ok(report.traceCorrelation.derivedFields.includes("http103EarlyHints"));
assert.equal(
  report.optimizationVariants.variants.find((variant) => variant.id === "cloudflare-platform-era-provenance")?.provenanceFile,
  "bench/cloudflare-platform-eras.json",
  "Cloudflare platform era provenance must be tracked"
);
assert.equal(
  report.optimizationVariants.variants.find((variant) => variant.id === "tanstack-start-prerender-contract")?.bucket,
  "framework-prerender",
  "TanStack prerender support must stay in the prerender bucket"
);

const byName = new Map(report.rows.map((row) => [row.name, row]));

const next = byName.get("next");
assert.ok(next, "next optimization row missing");
assert.equal(next.prefetch.classification, "disabled-or-opt-in");
assert.ok(next.startupProbe.includes("wrangler check startup"));
assert.ok(next.workerdLocalHarness.startup.includes("wrangler check startup"));
assert.deepEqual(next.cloudflare.wrangler.compatibilityFlags, ["nodejs_compat", "nodejs_als", "global_fetch_strictly_public"]);
assert.ok(next.disclosures.includes("nodejs-compat-startup-surface"));
assert.ok(
  next.workerEntrypoint.status === "present" || next.disclosures.includes("startup-size-needs-build-output"),
  "Next should either expose a built Worker entrypoint or disclose that startup size needs build output"
);
assert.deepEqual(
  next.openNextCacheModes.map((mode) => mode.id).sort(),
  ["opennext-r2-regional-cache", "opennext-static-assets-cache"],
  "Next should expose the OpenNext cache-mode matrix"
);

const svelte = byName.get("svelte");
assert.ok(svelte, "svelte optimization row missing");
assert.equal(svelte.prefetch.classification, "selective");
assert.ok(svelte.prefetch.modes.includes("tap"));
assert.equal(svelte.assetCaching.immutableAssetHeaders, true);
assert.equal(svelte.routes.media.risk, "instrumented-layout");

const reactRouter = byName.get("react-router");
assert.ok(reactRouter, "react-router optimization row missing");
assert.equal(reactRouter.prefetch.classification, "selective");
assert.ok(reactRouter.prefetch.modes.includes("intent"));

const nuxt = byName.get("nuxt");
assert.ok(nuxt, "nuxt optimization row missing");
assert.equal(nuxt.cloudflare.wrangler.nodejsCompat, true);
assert.ok(nuxt.assetCaching.routeCacheEvidence.length > 0, "nuxt should expose route/cache-control evidence");

const tanstackStart = byName.get("tanstack-start");
assert.ok(tanstackStart, "tanstack-start optimization row missing");
assert.equal(tanstackStart.routes.chart.risk, "route-split");
assert.equal(tanstackStart.routes.media.risk, "route-split");

const waku = byName.get("waku");
assert.ok(waku, "waku optimization row missing");
assert.ok(waku.cloudflare.wrangler.compatibilityFlags.includes("nodejs_als"));
assert.equal(waku.routes.media.risk, "client-island");

for (const name of ["hono-vue", "react", "vue", "vue-c3"]) {
  const row = byName.get(name);
  assert.ok(row, `${name} optimization row missing`);
  assert.equal(row.prefetch.classification, "not-detected", `${name} should not treat preload-stripping code or generated HTML as broad prefetch`);
}

const qwik = byName.get("qwik");
assert.ok(qwik, "qwik optimization row missing");
assert.equal(qwik.routes.media.risk, "not-detected");

for (const row of report.rows.filter((item) => item.benchmarkEnabled)) {
  assert.ok(
    row.assetCaching.headersPath || row.assetCaching.staticAssetFileCount === 0,
    `${row.name} should disclose asset headers when static assets exist`
  );
  assert.ok(Array.isArray(row.boundaryLeaks), `${row.name} should include boundary leak scan results`);
  assert.ok(
    row.optimizationVariants.some((variant) => variant.class === "static-cache-contract"),
    `${row.name} should be covered by the static cache contract variant`
  );
  assert.ok(row.workerdLocalHarness?.build.includes(row.appDir), `${row.name} should include a workerd local build probe`);
}

console.log("Cloudflare optimization audit tests passed.");
