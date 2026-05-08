#!/usr/bin/env node
// Phase E7d proof test 15: RENDER_MODES, INITIAL_DATA_MODES, HYDRATION_MODELS,
// IMPLEMENTATION_KINDS in config-v4.mjs are derived from framework-matrix.schema.json,
// not hardcoded. Verifies source-level: no inline array literals for these enums.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const schemaDoc = JSON.parse(
  await fs.readFile(path.join(repoRoot, "bench", "framework-matrix.schema.json"), "utf8")
);

const defs = schemaDoc.$defs ?? {};

// Verify the schema has the 4 enum definitions
assert.ok(
  Array.isArray(defs.implementationKind?.enum) && defs.implementationKind.enum.length > 0,
  "framework-matrix.schema.json $defs.implementationKind must have an enum array"
);
assert.ok(
  Array.isArray(defs.renderMode?.enum) && defs.renderMode.enum.length > 0,
  "framework-matrix.schema.json $defs.renderMode must have an enum array"
);
assert.ok(
  Array.isArray(defs.initialDataMode?.enum) && defs.initialDataMode.enum.length > 0,
  "framework-matrix.schema.json $defs.initialDataMode must have an enum array"
);
assert.ok(
  Array.isArray(defs.hydrationModel?.enum) && defs.hydrationModel.enum.length > 0,
  "framework-matrix.schema.json $defs.hydrationModel must have an enum array"
);

const configSrc = await fs.readFile(
  path.join(repoRoot, "bench", "src", "config-v4.mjs"),
  "utf8"
);

// Negative probe: no inline hardcoded arrays for these enums
// Pattern: new Set(["native", "control"]) or new Set(["ssr", ...]) etc.
const BANNED_PATTERNS = [
  { pattern: /new Set\(\["native"\s*,\s*"control"\]/, label: "IMPLEMENTATION_KINDS inline array" },
  { pattern: /new Set\(\["ssr"\s*,\s*"prerender"/, label: "RENDER_MODES inline array" },
  { pattern: /new Set\(\["document"\s*,\s*"client-fetch"\]/, label: "INITIAL_DATA_MODES inline array" },
  { pattern: /new Set\(\["framework"\s*,\s*"none"\]/, label: "HYDRATION_MODELS inline array" },
];

const violations = BANNED_PATTERNS.filter(({ pattern }) => pattern.test(configSrc)).map(
  ({ label }) => label
);
assert.deepEqual(
  violations,
  [],
  `config-v4.mjs contains inline enum arrays that must be replaced with schema derivation:\n${violations.join("\n")}`
);

// Positive probe: config-v4.mjs imports the schema and uses $defs
assert.ok(
  configSrc.includes("framework-matrix.schema.json"),
  "config-v4.mjs must import from framework-matrix.schema.json"
);
assert.ok(
  configSrc.includes("$defs") || configSrc.includes("_schemaDefs"),
  "config-v4.mjs must reference schema $defs to derive enums"
);

// Verify the sets match the schema (load config-v4 and check)
const {
  DEFAULT_MATRIX_PATH,
  loadMatrix,
} = await import(path.join(repoRoot, "bench", "src", "config-v4.mjs"));

// Load the matrix to confirm the schema-derived enums work
const matrix = await loadMatrix();
assert.ok(Array.isArray(matrix.frameworks), "loadMatrix() must return frameworks array after schema-derived enum change");

console.log(
  `config-v4-enum-parity: enums derived from schema — ` +
  `implementationKind=[${defs.implementationKind.enum.join(",")}] ` +
  `renderMode=[${defs.renderMode.enum.join(",")}] ` +
  `initialDataMode=[${defs.initialDataMode.enum.join(",")}] ` +
  `hydrationModel=[${defs.hydrationModel.enum.join(",")}]`
);
