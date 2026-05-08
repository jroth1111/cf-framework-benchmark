#!/usr/bin/env node
// Phase E4 proof test 18: contracts/v5.json validates against contracts/v5.schema.json,
// and representative defects (missing required field, wrong kind, invalid type) are
// surfaced as schema errors rather than silently accepted. Pairs with the runtime
// schema-driven required hash list in bench/src/run.mjs.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { validate } from "../bench/src/validate-schema.mjs";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const v5Path = path.join(repoRoot, "contracts", "v5.json");
const schemaPath = path.join(repoRoot, "contracts", "v5.schema.json");

const liveV5 = JSON.parse(await fs.readFile(v5Path, "utf8"));
const schema = JSON.parse(await fs.readFile(schemaPath, "utf8"));

const positive = validate(schema, liveV5);
assert.deepEqual(positive, { ok: true, errors: [] }, `live contracts/v5.json must pass schema:\n${positive.errors.join("\n")}`);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectFails(mutate, expectedFragment) {
  const broken = clone(liveV5);
  mutate(broken);
  const result = validate(schema, broken);
  assert.equal(result.ok, false, `expected schema failure for "${expectedFragment}" but validation passed`);
  const text = result.errors.join("\n");
  assert.match(text, new RegExp(expectedFragment), `expected error to mention "${expectedFragment}" but got:\n${text}`);
}

expectFails((c) => { delete c.contractVersion; }, 'missing required property "contractVersion"');
expectFails((c) => { c.routes[0].kind = "page"; }, "not in enum");
expectFails((c) => { delete c.routes[0].route; }, 'missing required property "route"');
expectFails((c) => { c.routes[0].route = "stays"; }, "does not match pattern");
expectFails((c) => { c.routes[0].includeInAssetClassification = "yes"; }, "expected type boolean");
expectFails((c) => { c.routes[0].suites = ["mpa", "mpa"]; }, "duplicate item");

console.log("contracts schema proof OK");
