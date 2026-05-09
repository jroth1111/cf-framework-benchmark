#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { handleControlRequest } from "../packages/bench-control/src/index.js";
import { NO_STORE } from "../packages/bench-cache/src/index.js";
import { esc, parseIntParam, toUrl, withServerTiming } from "../packages/bench-utils/src/index.js";

assert.equal(parseIntParam("12", 0), 12);
assert.equal(parseIntParam("12.9", 0), 12);
assert.equal(parseIntParam("-2.9", 0), -2);
assert.equal(parseIntParam("", 5), 5);
assert.equal(parseIntParam("x", undefined), undefined);
assert.equal(parseIntParam("Infinity", 7), 7);
assert.equal(toUrl("/stays?page=2").pathname, "/stays");
assert.equal(esc(`<test>"'&`), "&lt;test&gt;&quot;&#39;&amp;");

const headers = withServerTiming(null, performance.now() - 25);
assert.match(headers.get("server-timing") || "", /^cf_bench;dur=\d+\.\d;desc="/);

const response = handleControlRequest(
  "control",
  new Request("https://cf-bench.local/media", { method: "GET" }),
  performance.now() - 25
);

assert.ok(response);
assert.equal(response.status, 200);
assert.equal(response.headers.get("cache-control"), NO_STORE);
assert.match(response.headers.get("server-timing") || "", /^cf_bench;dur=\d+\.\d;desc="/);

const html = await response.text();
assert.match(html, /function renderMediaSummary\(node, item, showDescription\)/);
assert.match(html, /strong\.textContent = item && item\.title \? item\.title : '';/);
assert.doesNotMatch(html, /playerNode\.innerHTML =/);

// Verify control worker 404 fallback uses canonical NO_STORE and server-timing.
// Structural proof: the worker source must import NO_STORE from bench-cache and
// apply it on the 404 path (not use a bare literal that the cache-derivation
// gate would reject).
{
  const src = await fs.readFile(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "apps", "control", "src", "index.ts"),
    "utf8"
  );
  assert.ok(src.includes('import { NO_STORE } from "@cf-bench/bench-cache"'), "control worker must import NO_STORE from bench-cache");
  assert.ok(src.includes("cache-control") && src.includes("NO_STORE"), "control worker 404 must use NO_STORE for cache-control");
  assert.ok(src.includes("server-timing") && src.includes("cf_bench"), "control worker 404 must include server-timing");
}

console.log("control package regression tests passed");
