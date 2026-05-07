#!/usr/bin/env node
// Edge-case fixture coverage for the wrangler config parsers.
// Old hand-rolled parsers mishandled comments-in-strings and dotted keys; the
// library-backed parsers must round-trip both correctly.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readWranglerConfig } from "./cloudflare-config-audit.mjs";

async function withTempDir(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-bench-fixture-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

await withTempDir(async (dir) => {
  // wrangler.jsonc: line and block comments; "//" and "/*" embedded inside
  // string values must survive parsing untouched.
  const jsonc = [
    "{",
    '  // top-level comment',
    '  "name": "fixture", /* trailing block comment */',
    '  "main": "src/index.ts",',
    '  "compatibility_date": "2025-01-01",',
    '  "compatibility_flags": ["nodejs_compat"],',
    '  "vars": {',
    '    "BANNER": "see // https://example.invalid for details",',
    '    "PATTERN": "/* not a comment */ inside string",',
    '    "QUOTE": "she said \\"hi\\""',
    '  },',
    '  "trailing_array": [1, 2, 3,]',
    "}",
  ].join("\n");
  await fs.writeFile(path.join(dir, "wrangler.jsonc"), jsonc);
  const config = await readWranglerConfig(dir);
  assert.ok(config, "jsonc fixture should parse");
  assert.equal(config.format, "jsonc");
  assert.equal(config.parsed.name, "fixture");
  assert.equal(config.parsed.main, "src/index.ts");
  assert.deepEqual(config.parsed.compatibility_flags, ["nodejs_compat"]);
  assert.equal(
    config.parsed.vars.BANNER,
    "see // https://example.invalid for details",
    "// inside JSON string must not be stripped"
  );
  assert.equal(
    config.parsed.vars.PATTERN,
    "/* not a comment */ inside string",
    "/* */ inside JSON string must not be stripped"
  );
  assert.equal(config.parsed.vars.QUOTE, 'she said "hi"', "escaped quotes preserved");
  assert.deepEqual(config.parsed.trailing_array, [1, 2, 3], "trailing comma tolerated");
});

await withTempDir(async (dir) => {
  // wrangler.toml: dotted keys (a.b.c form), comments-inside-strings (#),
  // and arrays of tables. The hand-rolled parser stripped "#" anywhere on a
  // line and never supported dotted keys or [[arr]].
  const toml = [
    'name = "fixture # not a comment"',
    'main = "src/worker.ts"',
    'compatibility_date = "2025-01-01"',
    "# real comment",
    "compatibility_flags = [\"nodejs_compat\", \"nodejs_als\"]",
    "",
    "[assets]",
    'directory = "./public # also a path char"',
    "binding = \"ASSETS\"",
    "html_handling = \"auto-trailing-slash\"",
    "",
    "[observability]",
    "enabled = true",
    "",
    "[vars]",
    'GREETING = "hello # world"',
    "",
    "[deep.nested.section]",
    'value = "ok"',
    "",
    "[[routes]]",
    'pattern = "example.com/api/*"',
    "zone_name = \"example.com\"",
    "",
    "[[routes]]",
    'pattern = "example.com/static/*"',
    "zone_name = \"example.com\"",
  ].join("\n");
  await fs.writeFile(path.join(dir, "wrangler.toml"), toml);
  const config = await readWranglerConfig(dir);
  assert.ok(config, "toml fixture should parse");
  assert.equal(config.format, "toml");
  assert.equal(
    config.parsed.name,
    "fixture # not a comment",
    "# inside TOML string must not be stripped"
  );
  assert.deepEqual(config.parsed.compatibility_flags, ["nodejs_compat", "nodejs_als"]);
  assert.equal(
    config.parsed.assets.directory,
    "./public # also a path char",
    "# inside nested TOML string must not be stripped"
  );
  assert.equal(config.parsed.assets.html_handling, "auto-trailing-slash");
  assert.equal(config.parsed.observability.enabled, true);
  assert.equal(config.parsed.vars.GREETING, "hello # world");
  assert.equal(
    config.parsed.deep.nested.section.value,
    "ok",
    "dotted [a.b.c] section header must produce nested object"
  );
  assert.equal(Array.isArray(config.parsed.routes), true, "[[routes]] must produce array");
  assert.equal(config.parsed.routes.length, 2, "two array-of-tables entries");
  assert.equal(config.parsed.routes[0].pattern, "example.com/api/*");
  assert.equal(config.parsed.routes[1].pattern, "example.com/static/*");
});

await withTempDir(async (dir) => {
  // Malformed JSONC must throw via parseJsoncStrict rather than silently
  // returning an undefined value.
  await fs.writeFile(path.join(dir, "wrangler.jsonc"), '{ "name": "missing-brace"');
  await assert.rejects(
    readWranglerConfig(dir),
    /Failed to parse .*wrangler\.jsonc: Invalid JSONC/
  );
});

await withTempDir(async (dir) => {
  // Malformed TOML must throw; smol-toml raises a TomlError that the wrapper
  // surfaces with the file path.
  await fs.writeFile(path.join(dir, "wrangler.toml"), "[unclosed\nname = 1");
  await assert.rejects(
    readWranglerConfig(dir),
    /Failed to parse .*wrangler\.toml/
  );
});

await withTempDir(async (dir) => {
  // No wrangler config -> null (used by frameworks without a workers deploy).
  const result = await readWranglerConfig(dir);
  assert.equal(result, null, "missing config returns null");
});

console.log("Cloudflare config fixture tests passed.");
