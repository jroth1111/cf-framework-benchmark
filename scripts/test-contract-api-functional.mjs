#!/usr/bin/env node
// Functionally verifies handleContractApi produces correct responses for all
// contract API, SDK-fixture, and beacon routes. Tests status codes, headers,
// body structure, and error handling — not just route matching.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleContractApi } from "../packages/bench-contract/src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(await fs.readFile(path.join(repoRoot, "contracts", "v5.json"), "utf8"));

const apiRoutes = contract.routes.filter((r) => r.kind === "api");
const sdkRoutes = contract.routes.filter((r) => r.kind === "sdk-fixture");
const beaconRoutes = contract.routes.filter((r) => r.kind === "beacon");

function request(url, method = "GET") {
  return new Request(`https://bench.local${url}`, { method });
}

async function assertHandled(url, { method = "GET", expectStatus = 200 } = {}) {
  const res = handleContractApi("test-fw", request(url, method));
  assert.ok(res !== null, `${method} ${url} must be handled (got null)`);
  assert.equal(res.status, expectStatus, `${method} ${url} status`);
  return res;
}

// ── API routes: every contract api route must produce a non-null response ──

// GET /api/bench
{
  const res = await assertHandled("/api/bench");
  const body = await res.json();
  assert.equal(typeof body.framework, "string", "/api/bench body has framework");
  assert.equal(body.framework, "test-fw", "/api/bench framework matches");
  assert.ok(res.headers.get("content-type").includes("application/json"), "/api/bench content-type");
}

// GET /api/health
{
  const res = await assertHandled("/api/health");
  const body = await res.json();
  assert.equal(body.ok, true, "/api/health ok");
  assert.ok(res.headers.get("server-timing"), "/api/health has server-timing");
}

// GET /api/listings (default params)
{
  const res = await assertHandled("/api/listings");
  const body = await res.json();
  assert.ok(Array.isArray(body.results), "/api/listings results is array");
  assert.equal(typeof body.total, "number", "/api/listings has total");
  assert.ok(body.results.length > 0, "/api/listings has results");
  assert.ok(res.headers.get("cache-control"), "/api/listings has cache-control");
}

// GET /api/listings with query params
{
  const res = await assertHandled("/api/listings?page=2&pageSize=5");
  const body = await res.json();
  assert.ok(body.results.length <= 5, "/api/listings pageSize respected");
}

// GET /api/listings/:id (valid)
{
  const listRes = await assertHandled("/api/listings?pageSize=1");
  const [{ id }] = (await listRes.json()).results;
  const res = await assertHandled(`/api/listings/${id}`);
  const body = await res.json();
  assert.equal(body.listing.id, id, "/api/listings/:id returns correct listing");
}

// GET /api/listings/:id (invalid → 404)
{
  const res = await assertHandled("/api/listings/nonexistent-id-xyz", { expectStatus: 404 });
  const body = await res.json();
  assert.equal(body.error, "not_found", "/api/listings/:id 404 error message");
}

// GET /api/prices (default)
{
  const res = await assertHandled("/api/prices");
  const body = await res.json();
  assert.ok(Array.isArray(body.candles), "/api/prices has candles");
  assert.ok(body.candles.length > 0, "/api/prices has candle data");
}

// GET /api/prices (invalid symbol → 400)
{
  const res = await assertHandled("/api/prices?symbol=INVALID", { expectStatus: 400 });
  const body = await res.json();
  assert.equal(body.error, "unknown_symbol", "/api/prices 400 error message");
}

// GET /api/media (default params)
{
  const res = await assertHandled("/api/media");
  const body = await res.json();
  assert.ok(Array.isArray(body.results), "/api/media results is array");
  assert.ok(body.results.length > 0, "/api/media has results");
}

// ── SDK fixture routes ──

for (const route of sdkRoutes) {
  const res = await assertHandled(route.route);
  assert.ok(
    res.headers.get("content-type").includes("application/javascript"),
    `${route.route} content-type is javascript`
  );
  const body = await res.text();
  assert.ok(body.length > 0, `${route.route} body is non-empty`);
}

// ── Beacon route ──

{
  const res = await assertHandled("/__bench/beacon", { expectStatus: 204 });
  assert.ok(res.headers.get("cache-control")?.includes("no-store"), "/__bench/beacon is no-store");
  const beaconTiming = res.headers.get("server-timing") || "";
  assert.ok(beaconTiming.includes("cf_bench"), "/__bench/beacon must include server-timing");
  assert.ok(/cf_bench;dur=[0-9]/.test(beaconTiming), `/__bench/beacon server-timing must have numeric dur, got: ${beaconTiming}`);
  assert.equal(await res.text(), "", "/__bench/beacon body is empty");
}

// ── Unhandled routes return null ──

{
  const res = handleContractApi("test-fw", request("/unknown/route"));
  assert.equal(res, null, "unknown route returns null");
}

// ── Route count parity: all non-HTML contract routes handled ──

{
  const nonHtmlRoutes = contract.routes.filter((r) => r.kind !== "html");
  let handled = 0;
  for (const route of nonHtmlRoutes) {
    const testUrl = route.route.includes(":")
      ? route.route.replace(/:([^/]+)/, "test-val")
      : route.route;
    const res = handleContractApi("test-fw", request(testUrl));
    if (res !== null) handled++;
  }
  assert.equal(handled, nonHtmlRoutes.length, `all ${nonHtmlRoutes.length} non-HTML routes handled`);
}

console.log(
  `contract-api-functional: ${apiRoutes.length} API + ${sdkRoutes.length} SDK + ${beaconRoutes.length} beacon route(s) functionally verified`
);
