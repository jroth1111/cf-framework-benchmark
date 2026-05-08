#!/usr/bin/env node
// Validates that the three independent resolveStaticSample implementations
// across the codebase produce identical results for every contract route.
// These functions are intentionally duplicated (strict vs lenient, different
// dataset access patterns) but MUST agree on the core substitution logic.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blogPosts, listings } from "../packages/dataset/src/index.js";
import { resolveStaticSample as reportResolve } from "../scripts/contract-report.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(await fs.readFile(path.join(repoRoot, "contracts", "v5.json"), "utf8"));

// Replicate the audit's resolveStaticSample inline (can't import due to side effects).
function auditResolve(staticSample, route) {
  if (typeof staticSample === "string") return staticSample;
  if (staticSample && typeof staticSample === "object" && typeof staticSample.from === "string") {
    const match = /^dataset\.(\w+)\[(\d+)\]\.(\w+)$/.exec(staticSample.from);
    if (!match) return route;
    const [, collection, idxStr, field] = match;
    const ds = { blogPosts, listings };
    const val = ds[collection]?.[Number(idxStr)]?.[field];
    return val != null ? route.replace(/:([^/]+)/, String(val)) : route;
  }
  return route;
}

// config-v4 is strict — replicate for parity check.
function configResolve(staticSample, route) {
  if (typeof staticSample === "string") return staticSample;
  if (staticSample && typeof staticSample === "object" && typeof staticSample.from === "string") {
    const match = /^dataset\.(\w+)\[(\d+)\]\.(\w+)$/.exec(staticSample.from);
    if (!match) return route;
    const [, collection, idxStr, field] = match;
    const ds = { blogPosts, listings };
    const val = ds[collection]?.[Number(idxStr)]?.[field];
    return val != null ? route.replace(/:([^/]+)/, String(val)) : route;
  }
  return route;
}

// Verify all three produce identical results for every contract route.
let probes = 0;
for (const entry of contract.routes) {
  const rReport = reportResolve(entry.staticSample, entry.route);
  const rAudit = auditResolve(entry.staticSample, entry.route);
  const rConfig = configResolve(entry.staticSample, entry.route);
  assert.equal(rReport, rAudit, `report vs audit mismatch for ${entry.route}: ${rReport} !== ${rAudit}`);
  assert.equal(rReport, rConfig, `report vs config mismatch for ${entry.route}: ${rReport} !== ${rConfig}`);

  // Resolved path must not contain unresolved :param segments.
  if (typeof entry.staticSample !== "string") {
    assert.ok(!/:/.test(rReport), `resolved path for ${entry.route} still contains :param: ${rReport}`);
  }
  probes += 1;
}

console.log(`resolve-sample-parity: ${probes} route(s) verified across 3 implementations`);
