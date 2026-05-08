#!/usr/bin/env node
// Phase E7e proof test 16: handler defaults for pageSize and candles are derived
// from contracts/v5.json responseDefaults, not hardcoded.
// Verifies source-level wiring (static) since the handler runs on Workers —
// a live probe is run separately via test:contract-api-cache.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const v5Doc = JSON.parse(await fs.readFile(path.join(repoRoot, "contracts", "v5.json"), "utf8"));
const rdByRoute = Object.fromEntries(
  (v5Doc.routes ?? []).filter((r) => r.responseDefaults).map((r) => [r.route, r.responseDefaults])
);

// Verify v5 has the expected responseDefaults fields
assert.ok(
  typeof rdByRoute["/api/listings"]?.defaultPageSize === "number",
  "v5.json /api/listings must have responseDefaults.defaultPageSize"
);
assert.ok(
  typeof rdByRoute["/api/prices"]?.defaultCandles === "number",
  "v5.json /api/prices must have responseDefaults.defaultCandles"
);
assert.ok(
  typeof rdByRoute["/api/media"]?.defaultPageSize === "number",
  "v5.json /api/media must have responseDefaults.defaultPageSize"
);

const expectedPageSize = rdByRoute["/api/listings"].defaultPageSize;
const expectedMediaPageSize = rdByRoute["/api/media"].defaultPageSize;
const expectedCandles = rdByRoute["/api/prices"].defaultCandles;

// Static source probe: bench-contract/src/index.js must NOT hardcode the magic
// numbers directly — it must use DEFAULT_PAGE_SIZE / DEFAULT_CANDLES derived from v5.
const benchContractSrc = await fs.readFile(
  path.join(repoRoot, "packages", "bench-contract", "src", "index.js"),
  "utf8"
);

// Positive: imports v5 and declares derived constants
assert.ok(
  benchContractSrc.includes('from "../../../contracts/v5.json"'),
  "bench-contract must import from v5.json"
);
assert.ok(
  benchContractSrc.includes("_rd[") && benchContractSrc.includes("responseDefaults"),
  "bench-contract must derive page size and candles from v5 responseDefaults"
);
assert.ok(
  benchContractSrc.includes("DEFAULT_PAGE_SIZE"),
  "bench-contract must declare DEFAULT_PAGE_SIZE constant"
);
assert.ok(
  benchContractSrc.includes("DEFAULT_MEDIA_PAGE_SIZE"),
  "bench-contract must declare DEFAULT_MEDIA_PAGE_SIZE constant"
);
assert.ok(
  benchContractSrc.includes("DEFAULT_CANDLES"),
  "bench-contract must declare DEFAULT_CANDLES constant"
);

// Negative: the raw magic numbers must NOT appear as defaults in parseIntParam calls.
// Allow the numbers to appear in fallback expressions ( ?? 20 ) but not as positional
// default args to parseIntParam. Check that parseIntParam calls use the named constants.
const listingsMatch = benchContractSrc.match(/parseIntParam\(url\.searchParams\.get\("pageSize"\),\s*([^)]+)\)/);
assert.ok(listingsMatch, "handleListings must call parseIntParam for pageSize");
assert.ok(
  !listingsMatch[1].trim().match(/^\d+$/),
  `handleListings pageSize default must use a named constant, not bare ${listingsMatch?.[1]} — got "${listingsMatch?.[1]}"`
);

const mediaMatch = benchContractSrc.match(/handleMedia[\s\S]*?parseIntParam\(url\.searchParams\.get\("pageSize"\),\s*([^)]+)\)/);
assert.ok(mediaMatch, "handleMedia must call parseIntParam for pageSize");
assert.ok(
  !mediaMatch[1].trim().match(/^\d+$/),
  `handleMedia pageSize default must use a named constant, not bare ${mediaMatch?.[1]} — got "${mediaMatch?.[1]}"`
);

const pricesMatch = benchContractSrc.match(/parseIntParam\(url\.searchParams\.get\("points"\),\s*([^)]+)\)/);
assert.ok(pricesMatch, "handlePrices must call parseIntParam for points");
assert.ok(
  !pricesMatch[1].trim().match(/^\d+$/),
  `handlePrices points default must use a named constant, not bare number — got "${pricesMatch?.[1]}"`
);

console.log(
  `response-defaults-runtime: bench-contract derives DEFAULT_PAGE_SIZE=${expectedPageSize}, DEFAULT_MEDIA_PAGE_SIZE=${expectedMediaPageSize}, and DEFAULT_CANDLES=${expectedCandles} from v5 responseDefaults`
);
