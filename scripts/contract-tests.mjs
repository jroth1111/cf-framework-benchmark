#!/usr/bin/env node
import { blogPosts, listings } from "../packages/dataset/src/index.js";
import {
  DEFAULT_MATRIX_PATH,
  DEFAULT_SUITES_DIR,
  DEFAULT_TARGETS_PATH,
  loadSuite,
  parseCsvSet,
  resolveLiveTargets,
  toAbsolutePath,
} from "../bench/src/config-v3.mjs";

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

const timeoutMs = Number(argValue("--timeout", "12000"));
const only = parseCsvSet(argValue("--only", ""));
const suiteNames = parseCsvSet(argValue("--suites", "mpa_airbnb,spa_trading_media"));
const targetsPath = toAbsolutePath(argValue("--targets", null), DEFAULT_TARGETS_PATH);
const matrixPath = toAbsolutePath(argValue("--matrix", null), DEFAULT_MATRIX_PATH);
const suitesDir = toAbsolutePath(argValue("--suites-dir", null), DEFAULT_SUITES_DIR);

const failures = [];

function fail(message) {
  failures.push(message);
  console.error(`- ${message}`);
}

function expect(condition, message) {
  if (!condition) fail(message);
}

function expectHeaderIncludes(res, name, expected, label) {
  const value = res.headers.get(name) || "";
  expect(
    value.toLowerCase().includes(expected),
    `${label} missing ${name} contains ${expected} (got: ${value || "<empty>"})`
  );
}

function hasTestId(html, id) {
  const marker = String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`data-testid=["']${marker}["']`);
  return regex.test(html);
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchJson(label, url, expectedStatus) {
  let res;
  try {
    res = await fetchWithTimeout(url, { headers: { accept: "application/json" } });
  } catch (err) {
    fail(`${label} request failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }

  expect(res.status === expectedStatus, `${label} status expected ${expectedStatus}, got ${res.status}`);
  expectHeaderIncludes(res, "content-type", "application/json", label);
  expectHeaderIncludes(res, "server-timing", "cf_bench", label);

  try {
    const text = await res.text();
    return { res, body: text ? JSON.parse(text) : null };
  } catch (err) {
    fail(`${label} JSON parse failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function fetchHtml(label, url) {
  let res;
  try {
    res = await fetchWithTimeout(url, { headers: { accept: "text/html" } });
  } catch (err) {
    fail(`${label} request failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
  expect(res.status >= 200 && res.status < 400, `${label} status expected 2xx/3xx, got ${res.status}`);
  const text = await res.text();
  return { res, text };
}

function routeSample(route) {
  if (route === "/stays/:id") return "/stays/001";
  if (route === "/blog/:slug") return `/blog/${blogPosts[0]?.slug || "why-this-benchmark-exists"}`;
  return route;
}

function requiredTestIdsForRoute(route) {
  switch (route) {
    case "/":
      return [];
    case "/stays":
      return ["stay-card"];
    case "/stays/:id":
      return ["stay-description"];
    case "/blog":
      return ["blog-post-card"];
    case "/blog/:slug":
      return ["blog-html"];
    case "/chart":
      return ["chart-canvas", "symbol-select", "timeframe-select"];
    case "/media":
      return ["media-card", "media-player", "media-next"];
    default:
      return [];
  }
}

async function runFramework(framework, requiredRoutes) {
  const baseUrl = framework.url.replace(/\/$/, "");
  console.log(`\n${framework.name}`);

  const bench = await fetchJson(`${framework.name} /api/bench`, `${baseUrl}/api/bench`, 200);
  if (bench) {
    expectHeaderIncludes(bench.res, "cache-control", "no-store", `${framework.name} /api/bench`);
    expect(typeof bench.body?.isolateId === "string", `${framework.name} /api/bench isolateId missing`);
    expect(typeof bench.body?.hits === "number", `${framework.name} /api/bench hits missing`);
    expect(typeof bench.body?.now === "number", `${framework.name} /api/bench now missing`);
    expect(bench.body?.runtime === "cloudflare-workers", `${framework.name} /api/bench runtime mismatch`);
    expect(bench.body?.framework === framework.name, `${framework.name} /api/bench framework mismatch`);
    expect(bench.body?.contractVersion === "v3.0.0", `${framework.name} /api/bench contractVersion mismatch`);
    expect(Array.isArray(bench.body?.suiteSupport), `${framework.name} /api/bench suiteSupport missing`);
    for (const suite of suiteNames) {
      expect(
        bench.body?.suiteSupport?.includes(suite),
        `${framework.name} /api/bench suiteSupport missing ${suite}`
      );
    }
  }

  const health = await fetchJson(`${framework.name} /api/health`, `${baseUrl}/api/health`, 200);
  if (health) {
    expectHeaderIncludes(health.res, "cache-control", "no-store", `${framework.name} /api/health`);
    expect(health.body?.ok === true, `${framework.name} /api/health ok missing`);
    expect(typeof health.body?.ts === "number", `${framework.name} /api/health ts missing`);
  }

  const listingsRes = await fetchJson(`${framework.name} /api/listings`, `${baseUrl}/api/listings?pageSize=1`, 200);
  if (listingsRes) {
    expectHeaderIncludes(listingsRes.res, "cache-control", "s-maxage=60", `${framework.name} /api/listings`);
    expect(Array.isArray(listingsRes.body?.results), `${framework.name} /api/listings results missing`);
    expect(typeof listingsRes.body?.total === "number", `${framework.name} /api/listings total missing`);
  }

  const listingOk = await fetchJson(`${framework.name} /api/listings/001`, `${baseUrl}/api/listings/001`, 200);
  if (listingOk) {
    expectHeaderIncludes(listingOk.res, "cache-control", "s-maxage=300", `${framework.name} /api/listings/001`);
    expect(typeof listingOk.body?.listing?.id === "string", `${framework.name} /api/listings/001 listing missing`);
  }

  const listingMissing = await fetchJson(`${framework.name} /api/listings/999`, `${baseUrl}/api/listings/999`, 404);
  if (listingMissing) {
    expectHeaderIncludes(listingMissing.res, "cache-control", "no-store", `${framework.name} /api/listings/999`);
    expect(listingMissing.body?.error === "not_found", `${framework.name} /api/listings/999 error mismatch`);
  }

  const prices = await fetchJson(
    `${framework.name} /api/prices`,
    `${baseUrl}/api/prices?symbol=BTC&timeframe=1h&points=120`,
    200
  );
  if (prices) {
    expectHeaderIncludes(prices.res, "cache-control", "s-maxage=60", `${framework.name} /api/prices`);
    expect(prices.body?.symbol === "BTC", `${framework.name} /api/prices symbol mismatch`);
    expect(Array.isArray(prices.body?.candles), `${framework.name} /api/prices candles missing`);
  }

  const pricesBad = await fetchJson(`${framework.name} /api/prices bad`, `${baseUrl}/api/prices?symbol=BAD`, 400);
  if (pricesBad) {
    expectHeaderIncludes(pricesBad.res, "cache-control", "no-store", `${framework.name} /api/prices bad`);
    expect(pricesBad.body?.error === "unknown_symbol", `${framework.name} /api/prices bad error mismatch`);
  }

  const media = await fetchJson(`${framework.name} /api/media`, `${baseUrl}/api/media?pageSize=3`, 200);
  if (media) {
    expectHeaderIncludes(media.res, "cache-control", "s-maxage=60", `${framework.name} /api/media`);
    expect(Array.isArray(media.body?.results), `${framework.name} /api/media results missing`);
    expect(typeof media.body?.total === "number", `${framework.name} /api/media total missing`);
    expect(typeof media.body?.page === "number", `${framework.name} /api/media page missing`);
  }

  for (const route of requiredRoutes) {
    const sample = routeSample(route);
    const page = await fetchHtml(`${framework.name} ${sample}`, `${baseUrl}${sample}`);
    if (!page) continue;

    for (const marker of requiredTestIdsForRoute(route)) {
      expect(hasTestId(page.text, marker), `${framework.name} ${sample} missing data-testid=${marker}`);
    }
  }
}

const frameworks = await resolveLiveTargets({
  matrixPath,
  targetsPath,
  only,
  requireWorkers: true,
  requireEnabled: true,
});

const suites = await Promise.all([...suiteNames].map((name) => loadSuite(name, suitesDir)));
const requiredRoutes = [...new Set(suites.flatMap((suite) => suite.requiredRoutes))];

if (!requiredRoutes.length) {
  throw new Error("No required routes resolved from selected suites.");
}
if (!listings.length || !blogPosts.length) {
  throw new Error("Dataset is missing required fixtures for contract route samples.");
}

for (const framework of frameworks) {
  await runFramework(framework, requiredRoutes);
}

if (failures.length) {
  console.error(`\nContract tests failed (${failures.length}).`);
  process.exit(1);
}

console.log("\nContract tests passed.");
