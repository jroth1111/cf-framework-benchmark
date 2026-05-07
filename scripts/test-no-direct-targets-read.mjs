#!/usr/bin/env node
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SOURCE_EXTENSIONS = new Set([".mjs", ".cjs", ".js", ".mts", ".cts", ".ts", ".tsx", ".jsx"]);

const ALLOWED_FILES = new Set([
  "bench/src/config-v4.mjs",
  "scripts/test-no-direct-targets-read.mjs",
  "scripts/test-deploy-bench.mjs",
]);

const TARGETS_PATTERN = /targets\.live\.json/;
const NUL = String.fromCharCode(0);

function listTrackedFiles() {
  const out = execSync("git ls-files -z", { cwd: repoRoot });
  return String(out).split(NUL).map((entry) => entry.trim()).filter(Boolean);
}

function isSourceFile(relPath) {
  return SOURCE_EXTENSIONS.has(path.extname(relPath));
}

// Behavior: regex catches realistic violation shapes.
assert.ok(TARGETS_PATTERN.test(`fs.readFileSync("bench/targets.live.json", "utf8")`));
assert.ok(TARGETS_PATTERN.test(`path.join(dir, "targets.live.json")`));
assert.ok(TARGETS_PATTERN.test(`hashFile('bench/targets.live.json')`));
assert.ok(!TARGETS_PATTERN.test(`bench/framework-matrix.json`));

// Behavior: allowlist is a closed set; arbitrary new paths must not be silently accepted.
assert.ok(!ALLOWED_FILES.has("scripts/somewhere-new.mjs"));

// Behavior: the scan logic flags a synthetic violation and exonerates a synthetic allowlist hit.
function scanSynthetic(files) {
  const out = [];
  for (const [relPath, text] of files) {
    if (!TARGETS_PATTERN.test(text)) continue;
    if (ALLOWED_FILES.has(relPath)) continue;
    out.push(relPath);
  }
  return out;
}
assert.deepEqual(
  scanSynthetic([
    ["scripts/rogue.mjs", `await fs.readFile("bench/targets.live.json")`],
    ["bench/src/config-v4.mjs", `path.join(BENCH_DIR, "targets.live.json")`],
    ["scripts/innocent.mjs", `// touches bench/framework-matrix.json only`],
  ]),
  ["scripts/rogue.mjs"],
  "scan should flag exactly the non-allowlisted file that contains the pattern"
);

const tracked = listTrackedFiles();
assert.ok(tracked.length > 0, "git ls-files returned no tracked files");

const sourceFiles = tracked.filter(isSourceFile);
assert.ok(sourceFiles.length > 0, "no tracked source files matched the source extensions filter");

const violations = [];
let inspected = 0;

for (const relPath of sourceFiles) {
  const absPath = path.join(repoRoot, relPath);
  const text = await fs.readFile(absPath, "utf8");
  inspected += 1;
  if (!TARGETS_PATTERN.test(text)) continue;
  if (ALLOWED_FILES.has(relPath)) continue;
  violations.push(relPath);
}

if (violations.length) {
  console.error(
    `test-no-direct-targets-read: ${violations.length} non-allowlisted source file(s) reference \`targets.live.json\`:`
  );
  for (const file of violations) console.error(`  - ${file}`);
  console.error(
    "Only bench/src/config-v4.mjs may reference bench/targets.live.json by name. Other modules must use loadTargets / resolveLiveTargets / DEFAULT_TARGETS_PATH from config-v4.mjs."
  );
  process.exit(1);
}

const liveAllowed = [];
for (const relPath of ALLOWED_FILES) {
  const absPath = path.join(repoRoot, relPath);
  let text;
  try {
    text = await fs.readFile(absPath, "utf8");
  } catch {
    continue;
  }
  if (TARGETS_PATTERN.test(text)) liveAllowed.push(relPath);
}
assert.ok(
  liveAllowed.length > 0,
  `allowlist contains ${ALLOWED_FILES.size} entries but none of them currently reference targets.live.json — allowlist is stale and should be pruned`
);

assert.ok(
  liveAllowed.includes("bench/src/config-v4.mjs"),
  "canonical loader bench/src/config-v4.mjs must reference targets.live.json (it owns the read)"
);

console.log(
  `test-no-direct-targets-read: ${inspected} source files scanned, 0 violations, ${liveAllowed.length}/${ALLOWED_FILES.size} allowlisted file(s) live.`
);
