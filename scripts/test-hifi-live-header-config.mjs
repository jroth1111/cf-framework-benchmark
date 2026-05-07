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
assert.match(
  honoIndex,
  /app\.get\("\/hifi\/stays"[\s\S]*?c\.header\("server-timing"/,
  "Hono hifi list route must emit Server-Timing directly"
);
assert.match(
  honoIndex,
  /app\.get\("\/hifi\/stays\/:id"[\s\S]*?c\.header\("server-timing"/,
  "Hono hifi detail route must emit Server-Timing directly"
);

const svelteHook = read("apps/svelte/src/hooks.server.ts");
assert.match(
  svelteHook,
  /pathname === "\/hifi\/stays"[\s\S]*?return "list"/,
  "Svelte hifi list pages must classify as cacheable benchmark list pages"
);
assert.match(
  svelteHook,
  /\^\\\/hifi\\\/stays\\\/\[\^\/\]\+\$\//,
  "Svelte hifi detail pages must classify as cacheable benchmark detail pages"
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
