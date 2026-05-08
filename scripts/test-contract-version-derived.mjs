#!/usr/bin/env node
// Phase E7b proof test 11: contractVersion is derived from contracts/v5.json, not
// hardcoded. Verifies that no "v3.0.0" or "v4.0.0" literals exist in apps/ or
// packages/, and that bench-contract reads contractVersion from v5.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const v5Doc = JSON.parse(await fs.readFile(path.join(repoRoot, "contracts", "v5.json"), "utf8"));
assert.ok(
  typeof v5Doc.contractVersion === "string" && v5Doc.contractVersion.length > 0,
  "contracts/v5.json must have a non-empty contractVersion field"
);

// Negative probe: no "v3.0.0" or "v4.0.0" literal in apps/ or packages/
// (bench-contract must import contractVersion from v5.json instead)
const trackedFiles = execSync("git ls-files apps packages", { cwd: repoRoot, encoding: "utf8" })
  .split("\n")
  .map((f) => f.trim())
  .filter(Boolean);

const BANNED_LITERALS = ['"v3.0.0"', '"v4.0.0"'];
const violations = [];

for (const relPath of trackedFiles) {
  if (
    !relPath.endsWith(".ts") &&
    !relPath.endsWith(".js") &&
    !relPath.endsWith(".mjs") &&
    !relPath.endsWith(".json")
  ) {
    continue;
  }
  const absPath = path.join(repoRoot, relPath);
  let content;
  try {
    content = await fs.readFile(absPath, "utf8");
  } catch {
    continue;
  }
  for (const literal of BANNED_LITERALS) {
    if (content.includes(literal)) {
      const lines = content
        .split("\n")
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => line.includes(literal))
        .map(({ n }) => n);
      violations.push(`${relPath}:${lines.join(",")} contains banned literal ${literal}`);
    }
  }
}

assert.deepEqual(
  violations,
  [],
  `Banned contractVersion literals found — these must be removed in favour of importing from contracts/v5.json:\n${violations.join("\n")}`
);

// Positive probe: bench-contract/src/index.js imports v5.json for contractVersion
const benchContractSrc = await fs.readFile(
  path.join(repoRoot, "packages", "bench-contract", "src", "index.js"),
  "utf8"
);
assert.ok(
  benchContractSrc.includes("v5Contract.contractVersion"),
  'bench-contract/src/index.js must use v5Contract.contractVersion (not a hardcoded string)'
);
assert.ok(
  benchContractSrc.includes('from "../../../contracts/v5.json"'),
  'bench-contract/src/index.js must import from "../../../contracts/v5.json"'
);

// Positive probe: bench-types/src/index.ts uses string (not literal) for contractVersion
const benchTypesSrc = await fs.readFile(
  path.join(repoRoot, "packages", "bench-types", "src", "index.ts"),
  "utf8"
);
assert.ok(
  benchTypesSrc.includes("contractVersion: string"),
  'bench-types/src/index.ts BenchResponseV3.contractVersion must be typed as string, not a literal'
);
assert.ok(
  !benchTypesSrc.includes('contractVersion: "v'),
  'bench-types/src/index.ts must not have a literal contractVersion type like contractVersion: "v3.0.0"'
);

console.log(
  `contract-version-derived: contractVersion=${v5Doc.contractVersion} is derived from v5.json; no banned literals in apps/packages/`
);
