#!/usr/bin/env node
// Verifies that frameworks with hardcoded route matching cover all HTML routes
// from the v5 contract. If a new HTML route is added to the contract, these
// frameworks must update their route matching logic. This test catches drift.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(await fs.readFile(path.join(repoRoot, "contracts", "v5.json"), "utf8"));

const htmlRoutes = contract.routes.filter((r) => r.kind === "html");
const staticRoutes = htmlRoutes.filter((r) => !r.route.includes(":"));
const dynamicRoutes = htmlRoutes.filter((r) => r.route.includes(":"));

assert.ok(htmlRoutes.length >= 9, `expected ≥9 HTML routes, got ${htmlRoutes.length}`);

// Frameworks with hardcoded route matching in their worker/render files.
const frameworkFiles = {
  react: "apps/react/worker/index.ts",
  hono: "apps/hono/src/render.ts",
  "hono-solid": "apps/hono-solid/src/render.tsx",
  "hono-vue": "apps/hono-vue/src/index.ts",
  solid: "apps/solid/worker/render.tsx",
};

const sources = {};
for (const [fw, relPath] of Object.entries(frameworkFiles)) {
  sources[fw] = await fs.readFile(path.join(repoRoot, relPath), "utf8");
}

// Static routes must appear as exact string matches in the source.
for (const route of staticRoutes) {
  for (const [fw, src] of Object.entries(sources)) {
    assert.ok(
      src.includes(`"${route.route}"`) || src.includes(`'${route.route}'`),
      `${fw} must reference static HTML route "${route.route}"`
    );
  }
}

// Dynamic routes: verify each framework has regex patterns that match
// concrete paths derived from the contract's route templates.
for (const route of dynamicRoutes) {
  const testPath = route.route.replace(/:([^/]+)/g, "001");
  for (const [fw, src] of Object.entries(sources)) {
    // Extract regex literal patterns: /pattern/.test or new RegExp("pattern")
    const regexPatterns = [
      // /regex/ literals (unescape \/ → /)
      ...[...src.matchAll(/\/([^/\n]+)\//g)]
        .map((m) => m[1].replace(/\\\//g, "/")),
      // new RegExp("pattern") strings
      ...[...src.matchAll(/new RegExp\(\s*"([^"]+)"\s*\)/g)]
        .map((m) => m[1]),
    ];

    const canMatch = regexPatterns.some((p) => {
      try { return new RegExp(p).test(testPath); } catch { return false; }
    });

    // Also accept if the source contains the route template with :param syntax.
    const hasTemplate = src.includes(route.route);

    assert.ok(
      canMatch || hasTemplate,
      `${fw} must handle dynamic HTML route "${route.route}" (test path: "${testPath}")`
    );
  }
}

console.log(
  `framework-route-parity: ${htmlRoutes.length} HTML route(s) verified across ${Object.keys(frameworkFiles).length} framework(s)`
);
