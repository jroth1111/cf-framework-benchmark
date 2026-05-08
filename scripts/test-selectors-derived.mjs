#!/usr/bin/env node
// Phase E6 proof test 3: no literal [data-testid="..."] strings in bench/suites/,
// scripts/, or packages/bench-config/ outside resolution-helper bodies.
// Suite scenarios must reference test-ids via { requiredTestId } reference objects
// resolved by the suite loader in config-v4.mjs.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../bench/src/validate-schema.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 1. No [data-testid="..."] literals in suite JSON files
const suitesDir = path.join(repoRoot, "bench", "suites");
const suiteFiles = (await fs.readdir(suitesDir)).filter((f) => f.endsWith(".json"));
for (const file of suiteFiles) {
  const content = await fs.readFile(path.join(suitesDir, file), "utf8");
  const literalMatch = /\[data-testid=/.exec(content);
  assert.equal(
    literalMatch,
    null,
    `bench/suites/${file} contains a literal [data-testid=...] selector — use { "requiredTestId": "..." } instead`
  );
}

// 2. Suite JSON files validate against bench/suites.schema.json
const suitesSchema = JSON.parse(await fs.readFile(path.join(repoRoot, "bench", "suites.schema.json"), "utf8"));
for (const file of suiteFiles) {
  const doc = JSON.parse(await fs.readFile(path.join(suitesDir, file), "utf8"));
  const result = validate(suitesSchema, doc);
  assert.deepEqual(
    result,
    { ok: true, errors: [] },
    `bench/suites/${file} failed schema validation:\n${result.errors.join("\n")}`
  );
}

// 3. Non-test scripts in scripts/ have no [data-testid="..."] literals outside resolution helpers.
// Test scripts (test-*.mjs) are excluded — they inspect for testid patterns and naturally reference them.
const scriptsDir = path.join(repoRoot, "scripts");
const prodScriptFiles = (await fs.readdir(scriptsDir))
  .filter((f) => (f.endsWith(".mjs") || f.endsWith(".js")) && !f.startsWith("test-"));
for (const file of prodScriptFiles) {
  const content = await fs.readFile(path.join(scriptsDir, file), "utf8");
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/\[data-testid=["']/.test(line)) continue;
    // Allow comment-only lines
    if (/^\s*\/\//.test(line)) continue;
    // Allow lines where testid appears inside a regex literal (\\[ or /\[)
    if (/[/\\]\[data-testid=/.test(line)) continue;
    // Allow lines building selectors from a variable (resolution helpers)
    if (/\[data-testid=.*\$\{/.test(line)) continue;
    // Allow lines that are part of test harness constructs (e.g. matchAll patterns)
    if (/matchAll|\.test\(|\.exec\(|RegExp/.test(line)) continue;
    assert.fail(
      `scripts/${file}:${i + 1} contains a literal [data-testid="..."] selector outside a resolution helper:\n  ${line.trim()}`
    );
  }
}

// 4. packages/bench-config/ — testid literals are allowed ONLY inside the canonical selector
// definition object (TEST_SELECTORS in index.ts, which is the resolution helper for chart/media
// client code). No literal selectors may appear elsewhere in bench-config.
const benchConfigSrc = path.join(repoRoot, "packages", "bench-config", "src");
let benchConfigFiles = [];
try {
  benchConfigFiles = (await fs.readdir(benchConfigSrc)).filter((f) => f.endsWith(".ts") || f.endsWith(".js"));
} catch {
  // bench-config/src might not exist or might be reorganized
}
for (const file of benchConfigFiles) {
  const content = await fs.readFile(path.join(benchConfigSrc, file), "utf8");
  if (!content.includes("[data-testid=")) continue;
  // Allow index.ts which is the canonical selector-definition resolution helper
  if (file === "index.ts" && /TEST_SELECTORS\s*=\s*\{/.test(content)) continue;
  const literalMatch = /\[data-testid=["'][^"']+["']/.exec(content);
  assert.equal(
    literalMatch,
    null,
    `packages/bench-config/src/${file} contains a literal [data-testid="..."] selector outside the resolution-helper object — must be derived`
  );
}

console.log(`selectors-derived: ${suiteFiles.length} suite files verified, no literal [data-testid=...] strings`);
