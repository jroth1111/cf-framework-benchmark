#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function parseJsonc(path) {
  return JSON.parse(
    read(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "")
  );
}

function runWorkerFirst(path) {
  const config = parseJsonc(path);
  const value = config.assets?.run_worker_first;
  return Array.isArray(value) ? value : value === true ? ["*"] : [];
}

const honoIndex = read("apps/hono/src/index.ts");
const honoRender = read("apps/hono/src/render.ts");
assert.match(
  honoIndex,
  /handleHonoPageRequest\(c\.req\.raw\)[\s\S]*?if \(page\) return page/,
  "Hono catch-all must delegate document routes through handleHonoPageRequest"
);
assert.match(
  honoRender,
  /pathname === "\/hifi\/stays"[\s\S]*?return \{ page: "hifi-stays" \}/,
  "Hono hifi list route must be handled by the page renderer"
);
assert.match(
  honoRender,
  /\^\\\/hifi\\\/stays\\\/\(\[\^\/\]\+\)\$\//,
  "Hono hifi detail route must be handled by the page renderer"
);
assert.match(
  honoRender,
  /function handleHonoPageRequest[\s\S]*?const headers = withServerTiming\(null, performance\.now\(\)\)[\s\S]*?new Response\(result\.html, \{ status: result\.status, headers \}\)/,
  "Hono hifi document responses must emit Server-Timing through handleHonoPageRequest"
);

const svelteHook = read("apps/svelte/src/hooks.server.ts");
assert.match(
  svelteHook,
  /htmlCacheHeaderForPath\(event\.url\.pathname, profile\)/,
  "Svelte hifi pages must derive HTML cache policy from the shared cache package"
);
assert.match(
  svelteHook,
  /response\.headers\.set\([\s\S]*?"server-timing"[\s\S]*?cf_bench/,
  "Svelte hifi document responses must emit Server-Timing through the shared HTML hook"
);

for (const [name, configPath] of [
  ["vike", "apps/vike/wrangler.jsonc"],
  ["waku", "apps/waku/wrangler.jsonc"],
]) {
  const patterns = runWorkerFirst(configPath);
  assert.ok(patterns.includes("/hifi/stays"), `${name} must run hifi list pages through the Worker`);
  assert.ok(patterns.includes("/hifi/stays/*"), `${name} must run hifi detail pages through the Worker`);
}

console.log("Hifi live header config tests passed.");
