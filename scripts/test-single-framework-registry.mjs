#!/usr/bin/env node
// E1 proof test: every framework appears in framework-matrix.json with a
// cloudflare block; cloudflare-frameworks.json and controls.json are gone;
// audit scripts no longer reference the deleted files.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const cwd = process.cwd();

async function exists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch (err) {
    if (err?.code === "ENOENT") return false;
    throw err;
  }
}

assert.equal(
  await exists(path.join(cwd, "bench", "cloudflare-frameworks.json")),
  false,
  "bench/cloudflare-frameworks.json must be deleted (folded into framework-matrix.json)"
);
assert.equal(
  await exists(path.join(cwd, "bench", "controls.json")),
  false,
  "bench/controls.json must be deleted (folded into framework-matrix.json as tier:control row)"
);

const matrix = JSON.parse(await fs.readFile(path.join(cwd, "bench", "framework-matrix.json"), "utf8"));
const rows = matrix.frameworks ?? [];
assert.ok(rows.length >= 1, "matrix must declare frameworks");

const requiredCloudflareKeys = [
  "officialGuide",
  "adapter",
  "cloudflareSupport",
  "maturity",
  "benchmarkMode",
  "verificationTarget",
];
for (const row of rows) {
  assert.ok(row.cloudflare, `framework ${row.name} missing cloudflare block`);
  for (const key of requiredCloudflareKeys) {
    assert.ok(
      typeof row.cloudflare[key] === "string" && row.cloudflare[key].length > 0,
      `framework ${row.name} missing cloudflare.${key}`
    );
  }
}

const controlRow = rows.find((row) => row.tier === "control");
assert.ok(controlRow, "matrix must include a tier:control row");
assert.equal(controlRow.benchmarkEnabled, false, "control row must not be benchmark-enabled");
assert.equal(controlRow.excludeFromScoreboards, true, "control row must be excluded from scoreboards");

const auditPaths = [
  path.join(cwd, "scripts", "cloudflare-config-audit.mjs"),
  path.join(cwd, "scripts", "cloudflare-optimization-audit.mjs"),
];
for (const filePath of auditPaths) {
  const source = await fs.readFile(filePath, "utf8");
  assert.equal(
    source.includes("cloudflare-frameworks.json"),
    false,
    `${filePath} must not reference cloudflare-frameworks.json (read from matrix.cloudflare instead)`
  );
  assert.equal(
    source.includes("controls.json"),
    false,
    `${filePath} must not reference controls.json (read tier:control row from matrix instead)`
  );
}

console.log("single-framework-registry proof test passed.");
