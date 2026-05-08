#!/usr/bin/env node
// Validates per-kind semantic constraints in contracts/v5.json that the JSON
// Schema cannot express (the custom validator lacks if/then). These invariants
// mirror what bench-cache and test-contract-api-cache enforce at runtime: HTML
// routes must declare cache strings, API routes must declare API cache and error
// cache, SDK-fixture routes must match SDK_CACHE_HEADER, beacon routes must be
// no-store, and cross-kind fields must be null.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SDK_CACHE_HEADER, NO_STORE } from "../packages/bench-cache/src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(await fs.readFile(path.join(repoRoot, "contracts", "v5.json"), "utf8"));

const CACHE_RE = /^public, max-age=0, s-maxage=\d+/;

for (const entry of contract.routes) {
  const label = `${entry.kind} route ${entry.route}`;

  if (entry.kind === "html") {
    // expectedHtmlCache must be a non-null string ("no-store" or cache directive).
    assert.equal(
      typeof entry.expectedHtmlCache,
      "string",
      `${label} expectedHtmlCache must be a string`
    );
    if (entry.expectedHtmlCache !== NO_STORE) {
      assert.match(
        entry.expectedHtmlCache,
        CACHE_RE,
        `${label} expectedHtmlCache must be "no-store" or a cache directive`
      );
    }
    // Cross-kind fields must be null.
    assert.equal(entry.expectedApiCache, null, `${label} expectedApiCache must be null`);
    assert.equal(entry.expectedErrorApiCache, null, `${label} expectedErrorApiCache must be null`);
    assert.equal(entry.responseDefaults, null, `${label} responseDefaults must be null`);
  }

  if (entry.kind === "api") {
    // expectedApiCache must be a non-empty string.
    assert.equal(
      typeof entry.expectedApiCache,
      "string",
      `${label} expectedApiCache must be a string`
    );
    assert.ok(entry.expectedApiCache.length > 0, `${label} expectedApiCache must be non-empty`);
    // expectedErrorApiCache must be string or null (null only if no error variant exists).
    assert.ok(
      entry.expectedErrorApiCache === null || typeof entry.expectedErrorApiCache === "string",
      `${label} expectedErrorApiCache must be string or null`
    );
    // Cross-kind fields must be null.
    assert.equal(entry.expectedHtmlCache, null, `${label} expectedHtmlCache must be null`);
    assert.equal(entry.expectedDatasetSource, null, `${label} expectedDatasetSource must be null`);
  }

  if (entry.kind === "sdk-fixture") {
    assert.equal(
      entry.expectedApiCache,
      SDK_CACHE_HEADER,
      `${label} expectedApiCache must match SDK_CACHE_HEADER`
    );
    assert.equal(entry.expectedHtmlCache, null, `${label} expectedHtmlCache must be null`);
    assert.equal(entry.expectedErrorApiCache, null, `${label} expectedErrorApiCache must be null`);
    assert.equal(entry.responseDefaults, null, `${label} responseDefaults must be null`);
    assert.equal(entry.expectedDatasetSource, null, `${label} expectedDatasetSource must be null`);
  }

  if (entry.kind === "beacon") {
    assert.equal(
      entry.expectedApiCache,
      NO_STORE,
      `${label} expectedApiCache must be "no-store"`
    );
    assert.equal(entry.expectedHtmlCache, null, `${label} expectedHtmlCache must be null`);
    assert.equal(entry.expectedErrorApiCache, null, `${label} expectedErrorApiCache must be null`);
    assert.equal(entry.responseDefaults, null, `${label} responseDefaults must be null`);
    assert.equal(entry.expectedDatasetSource, null, `${label} expectedDatasetSource must be null`);
  }
}

const counts = {};
for (const entry of contract.routes) counts[entry.kind] = (counts[entry.kind] || 0) + 1;
const summary = Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ");

console.log(`contract-kind-invariants: ${contract.routes.length} route(s) verified (${summary})`);
