#!/usr/bin/env node
// Phase E6 proof test 4: the literal slug "why-this-benchmark-exists" must only
// appear inside packages/dataset/. All other files must derive the blog post path
// from the dataset at load time via { from: "dataset.blogPosts[0].slug" }.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Use git ls-files to enumerate tracked files (excludes gitignored result JSON, node_modules, etc.)
const trackedFiles = execSync("git ls-files", { cwd: repoRoot, encoding: "utf8" })
  .split("\n")
  .map((f) => f.trim())
  .filter(Boolean);

const LITERAL = "why-this-benchmark-exists";
const ALLOWED_PREFIX = "packages/dataset/";

const violations = [];
for (const relPath of trackedFiles) {
  if (relPath.startsWith(ALLOWED_PREFIX)) continue;
  // Test scripts themselves may reference the literal as part of their own assertions
  if (path.basename(relPath).startsWith("test-") && relPath.startsWith("scripts/")) continue;
  // Only check text files likely to contain slugs
  if (
    !relPath.endsWith(".ts") &&
    !relPath.endsWith(".js") &&
    !relPath.endsWith(".mjs") &&
    !relPath.endsWith(".json")
  ) {
    // Only check code and data files, not docs/logs/markdown
    continue;
  }
  const absPath = path.join(repoRoot, relPath);
  let content;
  try {
    content = await fs.readFile(absPath, "utf8");
  } catch {
    continue;
  }
  if (content.includes(LITERAL)) {
    const lineNumbers = content
      .split("\n")
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => line.includes(LITERAL))
      .map(({ n }) => n);
    violations.push(`${relPath}:${lineNumbers.join(",")}`);
  }
}

assert.deepEqual(
  violations,
  [],
  `The literal "${LITERAL}" appears outside packages/dataset/ — all paths must be derived from the dataset at runtime:\n${violations.join("\n")}`
);

// Positive check: packages/dataset/ still contains the slug
const datasetIndex = path.join(repoRoot, "packages", "dataset", "src", "index.js");
const datasetContent = await fs.readFile(datasetIndex, "utf8");
assert.ok(
  datasetContent.includes(LITERAL),
  `packages/dataset/src/index.js must define the slug "${LITERAL}"`
);

// Positive check: v5.json uses { from: "dataset.blogPosts[0].slug" } for /blog/:slug
const v5Doc = JSON.parse(await fs.readFile(path.join(repoRoot, "contracts", "v5.json"), "utf8"));
const blogSlugRoute = v5Doc.routes.find((r) => r.route === "/blog/:slug");
assert.ok(blogSlugRoute, "v5.json must have a /blog/:slug route");
assert.ok(
  blogSlugRoute.staticSample && typeof blogSlugRoute.staticSample === "object" && blogSlugRoute.staticSample.from,
  `v5.json /blog/:slug staticSample must be a { from: ... } reference, got: ${JSON.stringify(blogSlugRoute.staticSample)}`
);

// Positive check: suite loader can resolve the path
const { loadSuite } = await import("../bench/src/config-v4.mjs");
const suite = await loadSuite("mpa_airbnb");
const blogPostScenario = suite.scenarios.find((s) => s.name === "blog_post");
assert.ok(blogPostScenario, "mpa_airbnb suite must have a blog_post scenario");
assert.equal(
  blogPostScenario.path,
  `/blog/${LITERAL}`,
  `loadSuite resolved path must equal /blog/${LITERAL}`
);

console.log(`dataset-derived-paths: "${LITERAL}" confined to packages/dataset/; suite loader resolves it correctly`);
