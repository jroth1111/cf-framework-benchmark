#!/usr/bin/env node
import assert from "node:assert/strict";

import { htmlCacheHeader } from "../packages/bench-cache/src/index.js";
import {
  expectedDatasetContent,
  expectedHtmlCache,
  requiredTestIdsForRoute,
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

console.log("contract report regression tests passed");
