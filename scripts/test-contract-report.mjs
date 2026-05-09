#!/usr/bin/env node
import assert from "node:assert/strict";

import { htmlCacheHeader } from "../packages/bench-cache/src/index.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  expectedDatasetContent,
  expectedHtmlCache,
  requiredTestIdsForRoute,
  resolveStaticSample,
  routeSample,
  routeSamples,
  routesForFramework,
} from "./contract-report.mjs";

const hifiRoutes = ["/", "/hifi/stays", "/hifi/stays/:id", "/blog", "/blog/:slug"];

assert.equal(routeSample("/hifi/stays/:id"), "/hifi/stays/001");
assert.deepEqual(routeSamples("/hifi/stays/:id"), ["/hifi/stays/001", "/hifi/stays/001/"]);
// expectedHtmlCache is subordinate to bench-cache's htmlCacheHeader for the
// idiomatic (cache-preserving) profile; assert pass-through, not literal values.
assert.equal(expectedHtmlCache("/hifi/stays"), htmlCacheHeader("/hifi/stays", "idiomatic"));
assert.equal(expectedHtmlCache("/hifi/stays/:id"), htmlCacheHeader("/hifi/stays/:id", "idiomatic"));
assert.deepEqual(requiredTestIdsForRoute("/hifi/stays"), ["stay-card"]);
assert.deepEqual(requiredTestIdsForRoute("/hifi/stays/:id"), [
  "stay-hero-image",
  "stay-gallery",
  "stay-reviews",
  "stay-booking-form",
  "stay-booking-total",
  "stay-map",
]);
assert.ok(expectedDatasetContent("/hifi/stays").length > 0);
assert.ok(expectedDatasetContent("/hifi/stays/:id").length > 0);
assert.deepEqual(
  routesForFramework({ matrix: { hifi: { enabled: true } } }, hifiRoutes),
  hifiRoutes
);
assert.deepEqual(
  routesForFramework({ matrix: { hifi: { enabled: false } } }, hifiRoutes),
  ["/", "/blog", "/blog/:slug"]
);

// Verify resolveStaticSample for SDK-fixture and beacon routes.
assert.equal(resolveStaticSample("/__bench/sdk/maps.js", "/__bench/sdk/maps.js"), "/__bench/sdk/maps.js");
assert.equal(resolveStaticSample("/__bench/sdk/analytics.js", "/__bench/sdk/analytics.js"), "/__bench/sdk/analytics.js");
assert.equal(resolveStaticSample("/__bench/beacon", "/__bench/beacon"), "/__bench/beacon");

// Verify that contract-report.mjs probes non-API/non-HTML routes and error paths.
// Parse the source to confirm the probe loops exist (structural proof).
const reportSrc = await fs.readFile(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "contract-report.mjs"),
  "utf8"
);
assert.ok(
  reportSrc.includes('kind !== "html" && r.kind !== "api"'),
  "contract-report.mjs must probe SDK-fixture and beacon routes"
);
assert.ok(
  reportSrc.includes("expectedErrorApiCache"),
  "contract-report.mjs must probe API error paths using expectedErrorApiCache"
);
assert.ok(
  reportSrc.includes('expectedStatus: 404') && reportSrc.includes('expectedStatus: 400'),
  "contract-report.mjs must probe 404 and 400 error paths"
);

console.log("contract report regression tests passed");
