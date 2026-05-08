#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validate, validateOrThrow } from "../bench/src/validate-schema.mjs";
import { buildOptimizationAudit } from "./cloudflare-optimization-audit.mjs";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const variantsPath = path.join(repoRoot, "bench", "cloudflare-optimization-variants.json");
const schemaPath = path.join(repoRoot, "bench", "cloudflare-optimization-variants.schema.json");

const liveDoc = JSON.parse(await fs.readFile(variantsPath, "utf8"));
const schema = JSON.parse(await fs.readFile(schemaPath, "utf8"));

assert.deepEqual(
  validate(schema, liveDoc),
  { ok: true, errors: [] },
  "live cloudflare optimization variants must pass schema validation"
);

await buildOptimizationAudit({ cwd: repoRoot });

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectFails(mutate, expectedMessageFragment) {
  const broken = clone(liveDoc);
  mutate(broken);
  const result = validate(schema, broken);
  assert.equal(result.ok, false, `expected schema failure for "${expectedMessageFragment}" but validation passed`);
  const concatenated = result.errors.join("\n");
  assert.match(
    concatenated,
    expectedMessageFragment instanceof RegExp ? expectedMessageFragment : new RegExp(expectedMessageFragment),
    `expected error to mention "${expectedMessageFragment}" but got:\n${concatenated}`
  );
}

expectFails(
  (doc) => {
    doc.variants[0].ranking = "optimised-only";
  },
  "not in enum"
);

expectFails(
  (doc) => {
    delete doc.variants[0].class;
  },
  /missing required property "class"/
);

expectFails(
  (doc) => {
    delete doc.variants[0].id;
  },
  /missing required property "id"/
);

expectFails(
  (doc) => {
    delete doc.variants[0].status;
  },
  /missing required property "status"/
);

expectFails(
  (doc) => {
    delete doc.variants[0].frameworks;
  },
  /missing required property "frameworks"/
);

expectFails(
  (doc) => {
    doc.variants[0].frameworks = 42;
  },
  "expected type string|array, got integer"
);

expectFails(
  (doc) => {
    doc.variants[0].status = "in-progress";
  },
  "not in enum"
);

expectFails(
  (doc) => {
    doc.variants[0].typoField = "oops";
  },
  /unexpected property "typoField"/
);

expectFails(
  (doc) => {
    doc.unrecognizedTopLevel = {};
  },
  /unexpected property "unrecognizedTopLevel"/
);

expectFails(
  (doc) => {
    doc.schemaVersion = "v1";
  },
  "does not match pattern"
);

expectFails(
  (doc) => {
    doc.generatedAt = "2026/05/05";
  },
  "does not match pattern"
);

expectFails(
  (doc) => {
    doc.variants = [];
  },
  /minItems 1/
);

expectFails(
  (doc) => {
    doc.requiredClasses = ["dup", "dup"];
  },
  /duplicate item at index 1/
);

expectFails(
  (doc) => {
    delete doc.rankingPolicy.canonical;
  },
  /missing required property "canonical"/
);

expectFails(
  (doc) => {
    doc.rankingPolicy.unexpected = "extra";
  },
  /unexpected property "unexpected"/
);

expectFails(
  (doc) => {
    doc.references[0] = "ftp://example.com";
  },
  "does not match pattern"
);

expectFails(
  (doc) => {
    doc.sourceRequirements[0].class = "Capitalized";
  },
  "does not match pattern"
);

expectFails(
  (doc) => {
    delete doc.sourceRequirements[0].source;
  },
  /missing required property "source"/
);

expectFails(
  (doc) => {
    doc.variants[0].id = "Bad-ID";
  },
  "does not match pattern"
);

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-bench-optvariants-schema-"));
const onDiskBroken = path.join(tmpDir, "broken-variants.json");
const broken = clone(liveDoc);
broken.variants[0].ranking = "optimised-only";
await fs.writeFile(onDiskBroken, JSON.stringify(broken, null, 2));
await assert.rejects(
  buildOptimizationAudit({ cwd: repoRoot, variantsPath: onDiskBroken }),
  /Schema validation failed for Cloudflare optimization variants at .*broken-variants\.json/
);
await fs.rm(tmpDir, { recursive: true, force: true });

assert.throws(
  () => validateOrThrow(schema, { schemaVersion: "1.0.0" }, "synthetic"),
  /missing required property "generatedAt"/
);

console.log("cloudflare-optimization-variants schema regression tests passed");
