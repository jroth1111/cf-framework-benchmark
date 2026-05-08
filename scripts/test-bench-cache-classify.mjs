#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyHtmlRoute, htmlCacheHeaderForPath } from "../packages/bench-cache/src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(await fs.readFile(path.join(repoRoot, "contracts", "v5.json"), "utf8"));

const htmlRoutes = contract.routes.filter((r) => r.kind === "html");

// 1. Every html route in the contract is reachable through classifyHtmlRoute.
//    Dynamic routes (:id, :slug) use their staticSample to construct a valid path.
//    :slug routes use a staticSample object referencing dataset — we just need
//    any string matching the /blog/:slug pattern.
for (const route of htmlRoutes) {
  let testPath;
  if (route.route.includes(":id")) {
    testPath = route.staticSample;
  } else if (route.route.includes(":slug")) {
    testPath = "/blog/test-post";
  } else {
    testPath = route.route;
  }

  const classified = classifyHtmlRoute(testPath);
  assert.equal(
    classified,
    route.route,
    `classifyHtmlRoute("${testPath}") must return "${route.route}", got "${classified}"`
  );
}

// 2. Unrecognized paths return null.
for (const bad of ["/unknown", "/api/listings", "/hifi/unknown"]) {
  assert.equal(classifyHtmlRoute(bad), null, `classifyHtmlRoute("${bad}") must return null`);
}

// 3. Trailing slashes are normalized to the base route.
assert.equal(classifyHtmlRoute("/stays/"), "/stays", "trailing slash on /stays must normalize");
assert.equal(classifyHtmlRoute("/blog/"), "/blog", "trailing slash on /blog must normalize");

// 4. htmlCacheHeaderForPath delegates correctly for a known route.
const header = htmlCacheHeaderForPath("/stays", "idiomatic");
assert.equal(
  header,
  "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
  "htmlCacheHeaderForPath(/stays, idiomatic) must return contract cache value"
);

// 5. htmlCacheHeaderForPath returns no-store for unknown paths.
assert.equal(htmlCacheHeaderForPath("/nonexistent"), "no-store");

console.log(
  `bench-cache-classify: ${htmlRoutes.length} html route(s) verified through classifyHtmlRoute`
);
