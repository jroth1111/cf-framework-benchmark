#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validate, validateOrThrow } from "../bench/src/validate-schema.mjs";
import { loadMatrix } from "../bench/src/config-v4.mjs";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const matrixPath = path.join(repoRoot, "bench", "framework-matrix.json");
const schemaPath = path.join(repoRoot, "bench", "framework-matrix.schema.json");

const liveMatrix = JSON.parse(await fs.readFile(matrixPath, "utf8"));
const schema = JSON.parse(await fs.readFile(schemaPath, "utf8"));

assert.deepEqual(validate(schema, liveMatrix), { ok: true, errors: [] }, "live matrix must pass schema validation");

await loadMatrix(matrixPath);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectFails(mutate, expectedMessageFragment) {
  const broken = clone(liveMatrix);
  mutate(broken);
  const result = validate(schema, broken);
  assert.equal(result.ok, false, `expected schema failure for "${expectedMessageFragment}" but validation passed`);
  const concatenated = result.errors.join("\n");
  assert.match(
    concatenated,
    new RegExp(expectedMessageFragment),
    `expected error to mention "${expectedMessageFragment}" but got:\n${concatenated}`
  );
}

expectFails(
  (m) => {
    m.frameworks[0].tier = "framework-runtimee";
  },
  "not in enum"
);

expectFails(
  (m) => {
    m.frameworks[0].benchmarkEnabled = "true";
  },
  "expected type boolean, got string"
);

expectFails(
  (m) => {
    m.frameworks[0].status = "in-progress";
  },
  "not in enum"
);

expectFails(
  (m) => {
    delete m.frameworks[0].name;
  },
  /missing required property "name"/
);

expectFails(
  (m) => {
    m.frameworks[0].typoField = "oops";
  },
  /unexpected property "typoField"/
);

expectFails(
  (m) => {
    m.frameworks[0].name = "Capitalized";
  },
  "does not match pattern"
);

expectFails(
  (m) => {
    m.frameworks[0].appDir = "packages/whatever";
  },
  "does not match pattern"
);

expectFails(
  (m) => {
    m.tiers["custom-tier"] = "an unauthorized tier";
  },
  /unexpected property "custom-tier"/
);

expectFails(
  (m) => {
    delete m.tiers["framework-runtime"];
  },
  /missing required property "framework-runtime"/
);

expectFails(
  (m) => {
    m.frameworks[0].deploy.command = "";
  },
  "minLength"
);

expectFails(
  (m) => {
    m.benchmarkDefaults.scenarioContracts.mpa_airbnb.home.renderMode = "server";
  },
  "not in enum"
);

expectFails(
  (m) => {
    m.benchmarkDefaults.scenarioContracts.mpa_airbnb.home.unknownContractField = true;
  },
  /unexpected property "unknownContractField"/
);

expectFails(
  (m) => {
    m.frameworks[0].hifi = { enabled: "yes" };
  },
  "expected type boolean, got string"
);

expectFails(
  (m) => {
    m.schemaVersion = "v1";
  },
  "does not match pattern"
);

expectFails(
  (m) => {
    m.frameworks = [];
  },
  /minItems 1/
);

expectFails(
  (m) => {
    m.unrecognizedTopLevel = {};
  },
  /unexpected property "unrecognizedTopLevel"/
);

const onDiskBroken = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "cf-bench-matrix-schema-")), "broken-matrix.json");
const broken = clone(liveMatrix);
broken.frameworks[0].tier = "framework-runtimee";
await fs.writeFile(onDiskBroken, JSON.stringify(broken, null, 2));
await assert.rejects(
  loadMatrix(onDiskBroken),
  /Schema validation failed for framework matrix at .*broken-matrix\.json/
);
await fs.rm(path.dirname(onDiskBroken), { recursive: true, force: true });

assert.throws(() => validateOrThrow(schema, { schemaVersion: "1.0.0" }, "synthetic"), /missing required property "source"/);

console.log("matrix-schema regression tests passed");
