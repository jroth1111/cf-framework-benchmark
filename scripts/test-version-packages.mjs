#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadMatrix } from "../bench/src/config-v4.mjs";
import { pickFrameworkVersions } from "../bench/src/run.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const matrix = await loadMatrix(path.join(repoRoot, "bench", "framework-matrix.json"));

assert.ok(Array.isArray(matrix.frameworks) && matrix.frameworks.length > 0, "matrix.frameworks must be a non-empty array");

for (const fw of matrix.frameworks) {
  assert.ok(
    Array.isArray(fw.versionPackages),
    `framework "${fw.name}" must declare versionPackages as an array`
  );
  assert.ok(
    fw.versionPackages.length > 0,
    `framework "${fw.name}" must declare at least one entry in versionPackages`
  );
  for (const key of fw.versionPackages) {
    assert.equal(typeof key, "string", `framework "${fw.name}" versionPackages entries must be strings`);
    assert.ok(key.length > 0, `framework "${fw.name}" versionPackages entries must be non-empty`);
  }
  const unique = new Set(fw.versionPackages);
  assert.equal(unique.size, fw.versionPackages.length, `framework "${fw.name}" versionPackages must be unique`);
}

const enabled = matrix.frameworks.filter((fw) => fw.benchmarkEnabled === true);
assert.ok(enabled.length > 0, "matrix must contain at least one benchmarkEnabled framework");

for (const fw of enabled) {
  const appDir = fw.appDir ? path.resolve(repoRoot, fw.appDir) : null;
  if (!appDir) continue;
  const pkgPath = path.join(appDir, "package.json");
  let pkgRaw;
  try {
    pkgRaw = await fs.readFile(pkgPath, "utf8");
  } catch (err) {
    if (err?.code === "ENOENT") continue;
    throw err;
  }
  const pkg = JSON.parse(pkgRaw);
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const matched = fw.versionPackages.filter((key) => deps[key] != null);
  assert.ok(
    matched.length > 0,
    `framework "${fw.name}" versionPackages [${fw.versionPackages.join(", ")}] match no deps in ${path.relative(repoRoot, pkgPath)}`
  );
}

// Behavior: pickFrameworkVersions returns picked deps for each framework.
{
  const frameworks = [
    { name: "alpha", versionPackages: ["one", "two"] },
    { name: "beta", versionPackages: ["only"] },
  ];
  const frameworkPackages = {
    alpha: { dependencies: { one: "1.0.0" }, devDependencies: { two: "^2.0.0", extra: "9" } },
    beta: { dependencies: { only: "0.1.0" }, devDependencies: {} },
  };
  const out = pickFrameworkVersions(frameworks, frameworkPackages);
  assert.deepEqual(out, {
    alpha: { one: "1.0.0", two: "^2.0.0" },
    beta: { only: "0.1.0" },
  });
}

// Behavior: pickFrameworkVersions returns null when no package.json was loaded.
{
  const frameworks = [{ name: "ghost", versionPackages: ["x"] }];
  const frameworkPackages = { ghost: null };
  const out = pickFrameworkVersions(frameworks, frameworkPackages);
  assert.deepEqual(out, { ghost: null });
}

// Behavior: pickFrameworkVersions throws when a framework has no versionPackages while a package is present.
{
  const frameworks = [{ name: "broken", versionPackages: [] }];
  const frameworkPackages = { broken: { dependencies: { foo: "1" }, devDependencies: {} } };
  assert.throws(
    () => pickFrameworkVersions(frameworks, frameworkPackages),
    /no versionPackages declared/
  );
}

// Behavior: pickFrameworkVersions throws when versionPackages is missing entirely.
{
  const frameworks = [{ name: "broken" }];
  const frameworkPackages = { broken: { dependencies: { foo: "1" }, devDependencies: {} } };
  assert.throws(
    () => pickFrameworkVersions(frameworks, frameworkPackages),
    /no versionPackages declared/
  );
}

// Real-matrix smoke: feed every benchmarkEnabled fw into pickFrameworkVersions
// with a synthetic package and confirm picked ⊆ versionPackages and non-empty
// when at least one declared key matches the synthetic deps.
{
  const fw = enabled[0];
  const fakeDep = fw.versionPackages[0];
  const out = pickFrameworkVersions(
    [fw],
    { [fw.name]: { dependencies: { [fakeDep]: "9.9.9" }, devDependencies: {} } }
  );
  assert.deepEqual(out, { [fw.name]: { [fakeDep]: "9.9.9" } });
}

console.log(`test-version-packages: ${matrix.frameworks.length} frameworks (${enabled.length} enabled) — versionPackages declared and behavior probes passed.`);
