#!/usr/bin/env node
import assert from "node:assert/strict";

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

console.log("control package regression tests passed");
