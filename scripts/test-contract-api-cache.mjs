#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(repoRoot, "contracts", "v5.json");
const contractTestsPath = path.join(repoRoot, "scripts", "contract-tests.mjs");

const contractV5 = JSON.parse(await fs.readFile(contractPath, "utf8"));
const contractTestsSource = await fs.readFile(contractTestsPath, "utf8");

const apiRoutes = contractV5.routes.filter((entry) => entry.kind === "api");
assert.ok(
  apiRoutes.length >= 6,
  `expected at least 6 api routes in contracts/v5.json (got ${apiRoutes.length})`
);

// 1. Every api route must declare expectedApiCache as a non-empty string.
for (const entry of apiRoutes) {
  assert.equal(
    typeof entry.expectedApiCache,
    "string",
    `contracts/v5.json route ${entry.route} missing expectedApiCache`
  );
  assert.ok(
    entry.expectedApiCache.length > 0,
    `contracts/v5.json route ${entry.route} has empty expectedApiCache`
  );
}

// 2. Routes that drive default-value response shape must declare responseDefaults
//    with the exact keys consumed by contract-tests.mjs.
const expectedDefaults = {
  "/api/listings": ["defaultPageSize", "defaultResultCount"],
  "/api/prices": ["defaultCandles"],
  "/api/media": ["defaultPageSize", "defaultResultCount"],
};

for (const [route, requiredKeys] of Object.entries(expectedDefaults)) {
  const entry = apiRoutes.find((r) => r.route === route);
  assert.ok(entry, `contracts/v5.json missing api route ${route}`);
  assert.ok(
    entry.responseDefaults && typeof entry.responseDefaults === "object",
    `contracts/v5.json route ${route} missing responseDefaults object`
  );
  for (const key of requiredKeys) {
    assert.equal(
      typeof entry.responseDefaults[key],
      "number",
      `contracts/v5.json route ${route} responseDefaults.${key} must be a number`
    );
    assert.ok(
      entry.responseDefaults[key] > 0,
      `contracts/v5.json route ${route} responseDefaults.${key} must be positive`
    );
  }
}

// 3. Routes without default-shape state (/api/bench, /api/health, /api/listings/:id)
//    must declare responseDefaults: null explicitly so consumers don't infer the
//    field is missing.
for (const route of ["/api/bench", "/api/health", "/api/listings/:id"]) {
  const entry = apiRoutes.find((r) => r.route === route);
  assert.ok(entry, `contracts/v5.json missing api route ${route}`);
  assert.equal(
    entry.responseDefaults,
    null,
    `contracts/v5.json route ${route} responseDefaults must be null (no default-value shape)`
  );
}

// 4. contract-tests.mjs must derive every cache-control assertion from a
//    @cf-bench/bench-cache helper — no hardcoded "no-store"/"s-maxage=N"
//    literals on cache-control expectations. Scan every
//    expectHeaderEqual(..., "cache-control", X, ...) call site and assert X is a
//    bench-cache helper call or a derived local identifier.
const cacheCallRe = /expectHeaderEqual\(\s*[^,]+,\s*"cache-control"\s*,\s*([^,]+?)\s*,/g;
const cacheCallSites = [];
for (const match of contractTestsSource.matchAll(cacheCallRe)) {
  cacheCallSites.push(match[1].trim());
}
assert.ok(cacheCallSites.length >= 6, `expected ≥6 cache-control assertions, got ${cacheCallSites.length}`);

const allowedExpressions =
  /^(apiCacheHeader\("[^"]+"\)|htmlCacheHeader\("[^"]+",\s*"idiomatic"\)|errorApiCacheHeader\("[^"]+"\)|expectedCache)$/;
const violations = cacheCallSites.filter((expr) => !allowedExpressions.test(expr));
assert.deepEqual(
  violations,
  [],
  `contract-tests.mjs has hardcoded cache-control literals (must derive from @cf-bench/bench-cache):\n${violations.map((v) => `  - ${v}`).join("\n")}`
);

// 5. Every api route declared in contracts/v5.json that contract-tests.mjs
//    actually exercises must be referenced through apiCacheHeader(...) at
//    least once — proves bench-cache is wired to the contract field.
const apiCacheHeaderRe = /apiCacheHeader\(\s*"([^"]+)"\s*\)/g;
const referencedRoutes = new Set();
for (const match of contractTestsSource.matchAll(apiCacheHeaderRe)) {
  referencedRoutes.add(match[1]);
}
const exercisedApiRoutes = ["/api/bench", "/api/health", "/api/listings", "/api/listings/:id", "/api/prices", "/api/media"];
for (const route of exercisedApiRoutes) {
  assert.ok(
    referencedRoutes.has(route),
    `contract-tests.mjs does not call apiCacheHeader("${route}") — cache assertion is not derived from @cf-bench/bench-cache`
  );
}

// 6. Every default-shape literal that used to be inline (20, 360) on api response
//    bodies must now flow through responseDefaults(...). Confirm responseDefaults
//    helper is referenced for the three routes with defaults.
const responseDefaultsRe = /responseDefaults\(\s*"([^"]+)"\s*\)/g;
const responseDefaultsRoutes = new Set();
for (const match of contractTestsSource.matchAll(responseDefaultsRe)) {
  responseDefaultsRoutes.add(match[1]);
}
for (const route of ["/api/listings", "/api/prices", "/api/media"]) {
  assert.ok(
    responseDefaultsRoutes.has(route),
    `contract-tests.mjs does not call responseDefaults("${route}") — default-value shape is not derived from contracts/v5.json`
  );
}

// 7. SDK-fixture and beacon routes must declare expectedApiCache matching
//    the constants in @cf-bench/bench-cache. These routes are handled by
//    bench-contract but were previously ungoverned by the contract.
const sdkRoutes = contractV5.routes.filter((entry) => entry.kind === "sdk-fixture");
const beaconRoutes = contractV5.routes.filter((entry) => entry.kind === "beacon");
assert.ok(sdkRoutes.length >= 2, `expected at least 2 sdk-fixture routes (got ${sdkRoutes.length})`);
assert.ok(beaconRoutes.length >= 1, `expected at least 1 beacon route (got ${beaconRoutes.length})`);

const { SDK_CACHE_HEADER, NO_STORE } = await import("../packages/bench-cache/src/index.js");
for (const entry of sdkRoutes) {
  assert.equal(
    entry.expectedApiCache,
    SDK_CACHE_HEADER,
    `contracts/v5.json route ${entry.route} expectedApiCache must match SDK_CACHE_HEADER`
  );
  assert.equal(
    entry.responseDefaults,
    null,
    `contracts/v5.json route ${entry.route} responseDefaults must be null`
  );
}
for (const entry of beaconRoutes) {
  assert.equal(
    entry.expectedApiCache,
    NO_STORE,
    `contracts/v5.json route ${entry.route} expectedApiCache must be no-store`
  );
  assert.equal(
    entry.responseDefaults,
    null,
    `contracts/v5.json route ${entry.route} responseDefaults must be null`
  );
}

console.log(
  `contract-api-cache: ${apiRoutes.length} api route(s) carry expectedApiCache; ${sdkRoutes.length} sdk-fixture route(s); ${beaconRoutes.length} beacon route(s); ${cacheCallSites.length} cache-control assertion(s) verified to flow through @cf-bench/bench-cache helpers; ${responseDefaultsRoutes.size} responseDefaults route(s) wired.`
);
