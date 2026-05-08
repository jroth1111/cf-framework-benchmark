#!/usr/bin/env node
// Validates that the OpenNext worker patch's classifyBenchHtmlRoute handles
// all dynamic HTML routes from the v5 contract. The patch duplicates route
// classification logic from bench-cache because it runs in a bundled worker
// that cannot import workspace packages. If a new dynamic HTML route is
// added to the contract, the patch must be updated to match.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyHtmlRoute } from "../packages/bench-cache/src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(await fs.readFile(path.join(repoRoot, "contracts", "v5.json"), "utf8"));

// Extract classifyBenchHtmlRoute from the Next patch script.
const patchSrc = await fs.readFile(
  path.join(repoRoot, "apps", "next", "scripts", "patch-opennext-worker.mjs"),
  "utf8"
);

// Dynamic HTML routes are routes with :param segments.
const dynamicHtmlRoutes = contract.routes.filter(
  (r) => r.kind === "html" && r.route.includes(":")
);

assert.ok(dynamicHtmlRoutes.length >= 3, `expected ≥3 dynamic HTML routes, got ${dynamicHtmlRoutes.length}`);

// Verify the patch's regex patterns cover all dynamic HTML routes.
for (const route of dynamicHtmlRoutes) {
  // Construct a test pathname by replacing :param with a concrete value.
  const testPath = route.route.replace(/:([^/]+)/, "001");
  const classified = classifyHtmlRoute(testPath);
  assert.equal(classified, route.route, `classifyHtmlRoute("${testPath}") must return "${route.route}"`);

  // Verify the patch includes the regex pattern for this route.
  const paramPattern = route.route.replace(/:([^/]+)/, "[^/]+");
  const expectedRegex = new RegExp(`\\^\\${
    paramPattern.replace(/\//g, "\\\\/")
  }\\$`.replace(/\^/, "^"));
  // Check the patch references the route's dynamic pattern.
  assert.ok(
    patchSrc.includes(route.route.replace(/:([^/]+)/, "[^/]+")) ||
    patchSrc.includes(route.route),
    `Next patch must reference dynamic HTML route pattern for ${route.route}`
  );
}

console.log(`next-patch-parity: ${dynamicHtmlRoutes.length} dynamic HTML route(s) verified in OpenNext patch`);
