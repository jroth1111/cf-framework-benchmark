#!/usr/bin/env node
// Phase E1 proof test 17: no inline /hifi/stays* route registrations in
// apps/{hono,honox}/src/**. All v5 contract routes must be handled either by
// handleContractApi (API routes) or by the app's normal page-request handler
// (HTML routes) — not as early ad-hoc Hono app.get() registrations.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Collect tracked source files in apps/hono and apps/honox
const trackedFiles = execSync("git ls-files apps/hono apps/honox", { cwd: repoRoot, encoding: "utf8" })
  .split("\n")
  .map((f) => f.trim())
  .filter(Boolean)
  .filter((f) => f.endsWith(".ts") || f.endsWith(".js") || f.endsWith(".tsx") || f.endsWith(".jsx"));

// Negative probe: no inline app.get("/hifi/stays") or app.get("/hifi/stays/:id") calls
const BANNED_PATTERNS = [
  /app\.get\s*\(\s*["'`]\/hifi\/stays["'``]/,
  /app\.get\s*\(\s*["'`]\/hifi\/stays\/:id["'``]/,
];

const violations = [];

for (const relPath of trackedFiles) {
  const absPath = path.join(repoRoot, relPath);
  let content;
  try {
    content = await fs.readFile(absPath, "utf8");
  } catch {
    continue;
  }
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(content)) {
      violations.push(`${relPath}: contains banned inline route registration matching ${pattern}`);
    }
  }
}

assert.deepEqual(
  violations,
  [],
  `Inline /hifi/stays* route registrations found — these must be handled by handleHonoPageRequest or handleContractApi:\n${violations.join("\n")}`
);

// Positive probe: hono app delegates to handleContractApi in the catch-all
const honoIndex = await fs.readFile(
  path.join(repoRoot, "apps", "hono", "src", "index.ts"),
  "utf8"
);
assert.ok(
  honoIndex.includes("handleContractApi"),
  "apps/hono/src/index.ts must delegate to handleContractApi"
);
assert.ok(
  honoIndex.includes("handleHonoPageRequest"),
  "apps/hono/src/index.ts must delegate to handleHonoPageRequest for HTML routes"
);

// Positive probe: hono render.ts handles /hifi/stays routes
const honoRender = await fs.readFile(
  path.join(repoRoot, "apps", "hono", "src", "render.ts"),
  "utf8"
);
assert.ok(
  honoRender.includes("/hifi/stays"),
  "apps/hono/src/render.ts must handle /hifi/stays routes via handleHonoPageRequest"
);

console.log(
  `no-inline-route-registration: ${trackedFiles.length} files checked; no inline /hifi/stays* registrations found`
);
