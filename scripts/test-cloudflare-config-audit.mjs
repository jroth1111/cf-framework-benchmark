#!/usr/bin/env node
import assert from "node:assert/strict";
import { buildCloudflareAudit } from "./cloudflare-config-audit.mjs";

const report = await buildCloudflareAudit();
assert.equal(report.ok, true, "enabled Workers targets should have complete Cloudflare audit metadata");
assert.equal(report.gapCount, 0, "enabled Workers targets should not have critical Cloudflare audit gaps");

const byName = new Map(report.frameworks.map((row) => [row.name, row]));

const next = byName.get("next");
assert.ok(next, "next audit row missing");
assert.equal(next.cloudflare.adapter, "@opennextjs/cloudflare");
assert.deepEqual(next.wrangler.compatibilityFlags, ["nodejs_compat", "nodejs_als", "global_fetch_strictly_public"]);
assert.equal(next.wrangler.assetRouting.mode, "asset-first-with-worker-fallback");

const react = byName.get("react");
assert.ok(react, "react audit row missing");
assert.equal(react.cloudflare.benchmarkMode, "wrapper-baseline");
assert.equal(react.wrangler.assetRouting.mode, "worker-first-for-contract-routes");
assert.deepEqual(react.wrangler.assetRouting.contractRoutesAssetFirst, []);

const reactRouter = byName.get("react-router");
assert.ok(reactRouter, "react-router audit row missing");
assert.equal(reactRouter.cloudflare.benchmarkMode, "full-stack-ssr");
assert.equal(reactRouter.wrangler.assetRouting.mode, "worker-only");

const astro = byName.get("astro");
assert.ok(astro, "astro audit row missing");
assert.equal(astro.cloudflare.notes, "Astro 6 requires Node 22+ in Workers Builds.");
assert.equal(astro.wrangler.assetRouting.mode, "worker-first-for-contract-routes");
assert.deepEqual(astro.wrangler.assetRouting.contractRoutesAssetFirst, []);
assert.deepEqual(astro.wrangler.assetRouting.routePatterns, ["*"]);

const waku = byName.get("waku");
assert.ok(waku, "waku audit row missing");
assert.equal(waku.cloudflare.maturity, "alpha");
assert.equal(waku.wrangler.nodejsCompat, true);

const qwik = byName.get("qwik");
assert.ok(qwik, "qwik audit row missing");
assert.equal(qwik.cloudflare.maturity, "beta");
assert.equal(qwik.wrangler.nodejsCompat, true);

const hifiReport = await buildCloudflareAudit({ hifiOnly: true });
assert.equal(hifiReport.ok, true, "hifi-mode audit should pass for the 5 reference frameworks");
assert.equal(hifiReport.gapCount, 0, "hifi-mode audit should report no gaps");
assert.equal(hifiReport.mode, "hifi");
assert.equal(hifiReport.enabledWorkersCount, 5, "hifi-mode audit should target the 5 reference frameworks");

const hifiByName = new Map(hifiReport.frameworks.map((row) => [row.name, row]));
for (const name of ["next", "redwood", "svelte", "qwik", "solidstart"]) {
  const row = hifiByName.get(name);
  assert.ok(row, `${name} hifi audit row missing`);
  assert.equal(row.hifi?.enabled, true, `${name} should declare hifi.enabled`);
  assert.equal(row.hifi?.imageTransforms, "enabled", `${name} should declare imageTransforms enabled`);
  assert.equal(row.gaps.length, 0, `${name} should have no hifi gaps`);
}

console.log("Cloudflare config audit tests passed.");
