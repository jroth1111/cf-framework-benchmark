#!/usr/bin/env node
import assert from "node:assert/strict";
import { buildOptimizationAudit } from "./cloudflare-optimization-audit.mjs";

const report = await buildOptimizationAudit();

assert.equal(report.ok, true, "optimization audit should not have required metadata gaps");
assert.equal(report.gaps.length, 0, "enabled benchmark apps should have complete optimization audit inputs");
assert.ok(report.sourceRequirements.includes("cloudflare/workers-sdk#7344"));
assert.ok(report.sourceRequirements.includes("TanStack/router#6400"));

const byName = new Map(report.rows.map((row) => [row.name, row]));

const next = byName.get("next");
assert.ok(next, "next optimization row missing");
assert.equal(next.prefetch.classification, "disabled-or-opt-in");
assert.ok(next.startupProbe.includes("wrangler check startup"));
assert.deepEqual(next.cloudflare.wrangler.compatibilityFlags, ["nodejs_compat", "nodejs_als", "global_fetch_strictly_public"]);

const svelte = byName.get("svelte");
assert.ok(svelte, "svelte optimization row missing");
assert.equal(svelte.prefetch.classification, "selective");
assert.ok(svelte.prefetch.modes.includes("tap"));
assert.equal(svelte.assetCaching.immutableAssetHeaders, true);

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

for (const row of report.rows.filter((item) => item.benchmarkEnabled)) {
  assert.ok(
    row.assetCaching.headersPath || row.assetCaching.staticAssetFileCount === 0,
    `${row.name} should disclose asset headers when static assets exist`
  );
  assert.ok(Array.isArray(row.boundaryLeaks), `${row.name} should include boundary leak scan results`);
}

console.log("Cloudflare optimization audit tests passed.");
