#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blogPosts, listings } from "../packages/dataset/src/index.js";
import {
  apiCacheHeader,
  errorApiCacheHeader,
  htmlCacheHeader,
} from "../packages/bench-cache/src/index.js";
import {
  DEFAULT_MATRIX_PATH,
  DEFAULT_SUITES_DIR,
  DEFAULT_TARGETS_PATH,
  loadSuite,
  parseCsvSet,
  resolveLiveTargets,
  toAbsolutePath,
} from "../bench/src/config-v4.mjs";

const CONTRACTS_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "contracts",
  "v5.json"
);
const CONTRACTS = JSON.parse(await fs.readFile(CONTRACTS_PATH, "utf8"));
const ROUTES_BY_PATH = new Map(CONTRACTS.routes.map((r) => [r.route, r]));

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

function expectHeaderEqual(res, name, expected, label) {
  const value = res.headers.get(name) || "";
  expect(
    value === expected,
    `${label} expected ${name}=${JSON.stringify(expected)}, got ${JSON.stringify(value)}`
  );
}

function expectBodyIncludes(html, expected, label) {
  expect(
    html.includes(expected),
    `${label} missing expected dataset content ${JSON.stringify(expected)}`
  );
}

function hasTestId(html, id) {
  const marker = String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`data-testid=["']${marker}["']`);
  return regex.test(html);
}

function hasScriptHydrationEvidence(html) {
  return /<script\b/i.test(html);
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
    res = await fetchWithTimeout(url, {
      headers: {
        accept: "text/html",
        "x-cf-bench-profile": "idiomatic",
      },
    });
  } catch (err) {
    fail(`${label} request failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
  expect(res.status >= 200 && res.status < 400, `${label} status expected 2xx/3xx, got ${res.status}`);
  expectHeaderIncludes(res, "content-type", "text/html", label);
  expectHeaderIncludes(res, "server-timing", "cf_bench", label);
  const text = await res.text();
  return { res, text };
}

async function fetchHtmlStatus(label, url) {
  let res;
  try {
    res = await fetchWithTimeout(url, {
      headers: {
        accept: "text/html",
        "x-cf-bench-profile": "idiomatic",
      },
      redirect: "follow",
    });
  } catch (err) {
    fail(`${label} request failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
  return { res, text: await res.text() };
}

function routeSample(route) {
  if (route === "/blog/:slug") return `/blog/${blogPosts[0]?.slug || "why-this-benchmark-exists"}`;
  const entry = ROUTES_BY_PATH.get(route);
  return entry?.staticSample ?? route;
}

function routeSamples(route) {
  const sample = routeSample(route);
  if (sample === "/") return [sample];
  if (route === "/chart" || route === "/media") return [sample];
  return [sample, `${sample}/`];
}

function requiredTestIdsForRoute(route) {
  return ROUTES_BY_PATH.get(route)?.requiredTestIds ?? [];
}

function responseDefaults(route) {
  return ROUTES_BY_PATH.get(route)?.responseDefaults ?? null;
}

function expectedDatasetContent(route) {
  const source = ROUTES_BY_PATH.get(route)?.expectedDatasetSource;
  if (source === "listings") return [listings[0]?.title].filter(Boolean);
  if (source === "blogPosts") return [blogPosts[0]?.title].filter(Boolean);
  return [];
}

function frameworkSupportsHifi(framework) {
  return framework?.matrix?.hifi?.enabled === true;
}

function suiteUsesHifi(suite) {
  return suite.requiredRoutes.some((route) => route.startsWith("/hifi/"));
}

function suiteSupportForFramework(framework) {
  return suites.filter((suite) => !suiteUsesHifi(suite) || frameworkSupportsHifi(framework)).map((suite) => suite.id);
}

async function runFramework(framework, requiredRoutes, expectedSuiteSupport) {
  const baseUrl = framework.url.replace(/\/$/, "");
  console.log(`\n${framework.name}`);

  const bench = await fetchJson(`${framework.name} /api/bench`, `${baseUrl}/api/bench`, 200);
  if (bench) {
    expectHeaderEqual(bench.res, "cache-control", apiCacheHeader("/api/bench"), `${framework.name} /api/bench`);
    expect(typeof bench.body?.isolateId === "string", `${framework.name} /api/bench isolateId missing`);
    expect(typeof bench.body?.hits === "number", `${framework.name} /api/bench hits missing`);
    expect(typeof bench.body?.now === "number", `${framework.name} /api/bench now missing`);
    expect(bench.body?.runtime === "cloudflare-workers", `${framework.name} /api/bench runtime mismatch`);
    expect(bench.body?.framework === framework.name, `${framework.name} /api/bench framework mismatch`);
    expect(bench.body?.contractVersion === "v3.0.0", `${framework.name} /api/bench contractVersion mismatch`);
    expect(Array.isArray(bench.body?.suiteSupport), `${framework.name} /api/bench suiteSupport missing`);
    for (const suite of expectedSuiteSupport) {
      expect(
        bench.body?.suiteSupport?.includes(suite),
        `${framework.name} /api/bench suiteSupport missing ${suite}`
      );
    }
    for (const suite of suiteNames) {
      if (expectedSuiteSupport.includes(suite)) continue;
      expect(
        !bench.body?.suiteSupport?.includes(suite),
        `${framework.name} /api/bench suiteSupport should not include unsupported ${suite}`
      );
    }
  }

  const health = await fetchJson(`${framework.name} /api/health`, `${baseUrl}/api/health`, 200);
  if (health) {
    expectHeaderEqual(health.res, "cache-control", apiCacheHeader("/api/health"), `${framework.name} /api/health`);
    expect(health.body?.ok === true, `${framework.name} /api/health ok missing`);
    expect(typeof health.body?.ts === "number", `${framework.name} /api/health ts missing`);
  }

  const listingsDefaults = responseDefaults("/api/listings");
  const listingsRes = await fetchJson(`${framework.name} /api/listings`, `${baseUrl}/api/listings?pageSize=1`, 200);
  if (listingsRes) {
    expectHeaderEqual(listingsRes.res, "cache-control", apiCacheHeader("/api/listings"), `${framework.name} /api/listings`);
    expect(Array.isArray(listingsRes.body?.results), `${framework.name} /api/listings results missing`);
    expect(typeof listingsRes.body?.total === "number", `${framework.name} /api/listings total missing`);
    expect(listingsRes.body?.pageSize === 1, `${framework.name} /api/listings pageSize mismatch for explicit query`);
  }

  const listingsDefault = await fetchJson(`${framework.name} /api/listings default`, `${baseUrl}/api/listings`, 200);
  if (listingsDefault) {
    expect(
      listingsDefault.body?.pageSize === listingsDefaults?.defaultPageSize,
      `${framework.name} /api/listings default pageSize mismatch (expected ${listingsDefaults?.defaultPageSize})`
    );
    expect(
      listingsDefault.body?.results?.length === listingsDefaults?.defaultResultCount,
      `${framework.name} /api/listings default result count mismatch (expected ${listingsDefaults?.defaultResultCount})`
    );
  }

  const listingOk = await fetchJson(`${framework.name} /api/listings/001`, `${baseUrl}/api/listings/001`, 200);
  if (listingOk) {
    expectHeaderEqual(listingOk.res, "cache-control", apiCacheHeader("/api/listings/:id"), `${framework.name} /api/listings/001`);
    expect(typeof listingOk.body?.listing?.id === "string", `${framework.name} /api/listings/001 listing missing`);
  }

  const listingMissing = await fetchJson(`${framework.name} /api/listings/999`, `${baseUrl}/api/listings/999`, 404);
  if (listingMissing) {
    expectHeaderEqual(listingMissing.res, "cache-control", errorApiCacheHeader("/api/listings/:id"), `${framework.name} /api/listings/999`);
    expect(listingMissing.body?.error === "not_found", `${framework.name} /api/listings/999 error mismatch`);
  }

  const pricesDefaults = responseDefaults("/api/prices");
  const prices = await fetchJson(
    `${framework.name} /api/prices`,
    `${baseUrl}/api/prices?symbol=BTC&timeframe=1h&points=120`,
    200
  );
  if (prices) {
    expectHeaderEqual(prices.res, "cache-control", apiCacheHeader("/api/prices"), `${framework.name} /api/prices`);
    expect(prices.body?.symbol === "BTC", `${framework.name} /api/prices symbol mismatch`);
    expect(Array.isArray(prices.body?.candles), `${framework.name} /api/prices candles missing`);
    expect(prices.body?.candles?.length === 120, `${framework.name} /api/prices candles length mismatch`);
  }

  const pricesDefault = await fetchJson(`${framework.name} /api/prices default`, `${baseUrl}/api/prices?symbol=BTC`, 200);
  if (pricesDefault) {
    expect(
      pricesDefault.body?.candles?.length === pricesDefaults?.defaultCandles,
      `${framework.name} /api/prices default candles mismatch (expected ${pricesDefaults?.defaultCandles})`
    );
  }

  const pricesBad = await fetchJson(`${framework.name} /api/prices bad`, `${baseUrl}/api/prices?symbol=BAD`, 400);
  if (pricesBad) {
    expectHeaderEqual(pricesBad.res, "cache-control", errorApiCacheHeader("/api/prices"), `${framework.name} /api/prices bad`);
    expect(pricesBad.body?.error === "unknown_symbol", `${framework.name} /api/prices bad error mismatch`);
  }

  const mediaDefaults = responseDefaults("/api/media");
  const media = await fetchJson(`${framework.name} /api/media`, `${baseUrl}/api/media?pageSize=3`, 200);
  if (media) {
    expectHeaderEqual(media.res, "cache-control", apiCacheHeader("/api/media"), `${framework.name} /api/media`);
    expect(Array.isArray(media.body?.results), `${framework.name} /api/media results missing`);
    expect(typeof media.body?.total === "number", `${framework.name} /api/media total missing`);
    expect(typeof media.body?.page === "number", `${framework.name} /api/media page missing`);
    expect(media.body?.pageSize === 3, `${framework.name} /api/media pageSize mismatch for explicit query`);
  }

  const mediaDefault = await fetchJson(`${framework.name} /api/media default`, `${baseUrl}/api/media`, 200);
  if (mediaDefault) {
    expect(
      mediaDefault.body?.pageSize === mediaDefaults?.defaultPageSize,
      `${framework.name} /api/media default pageSize mismatch (expected ${mediaDefaults?.defaultPageSize})`
    );
    expect(
      mediaDefault.body?.results?.length === mediaDefaults?.defaultResultCount,
      `${framework.name} /api/media default result count mismatch (expected ${mediaDefaults?.defaultResultCount})`
    );
  }

  for (const route of requiredRoutes) {
    for (const sample of routeSamples(route)) {
      const page = await fetchHtml(`${framework.name} ${sample}`, `${baseUrl}${sample}`);
      if (!page) continue;

      // HTML probes always send x-cf-bench-profile=idiomatic; bench-cache emits the
      // canonical (preserved) value for that profile.
      const expectedCache = htmlCacheHeader(route, "idiomatic");
      expectHeaderEqual(page.res, "cache-control", expectedCache, `${framework.name} ${sample}`);

      for (const marker of requiredTestIdsForRoute(route)) {
        expect(hasTestId(page.text, marker), `${framework.name} ${sample} missing data-testid=${marker}`);
      }
      const suiteScenario = suiteByRoute.get(route);
      const routeContract = suiteScenario
        ? framework.matrix?.scenarioContracts?.[suiteScenario.suiteId]?.[suiteScenario.scenarioName]
        : null;
      if (String(framework.matrix?.tier || "").startsWith("framework-") && routeContract?.hydrationModel === "framework") {
        expect(
          hasScriptHydrationEvidence(page.text),
          `${framework.name} ${sample} missing framework hydration script evidence`
        );
      }
      for (const expected of expectedDatasetContent(route)) {
        expectBodyIncludes(page.text, expected, `${framework.name} ${sample}`);
      }
    }
  }

  const missingPage = await fetchHtmlStatus(
    `${framework.name} unknown document route`,
    `${baseUrl}/__cf_bench_missing_contract_route`
  );
  if (missingPage) {
    expect(
      missingPage.res.status === 404,
      `${framework.name} unknown document route should not SPA/index shadow with 200 (got ${missingPage.res.status})`
    );
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
const suiteByRoute = new Map();
for (const suite of suites) {
  for (const scenario of suite.scenarios) {
    const route = requiredRoutes.find(
      (candidate) => candidate === scenario.path || routeSample(candidate) === scenario.path
    );
    if (route && !suiteByRoute.has(route)) {
      suiteByRoute.set(route, { suiteId: suite.id, scenarioName: scenario.name });
    }
  }
}

if (!requiredRoutes.length) {
  throw new Error("No required routes resolved from selected suites.");
}
if (!listings.length || !blogPosts.length) {
  throw new Error("Dataset is missing required fixtures for contract route samples.");
}

function routesForFramework(framework) {
  if (frameworkSupportsHifi(framework)) return requiredRoutes;
  return requiredRoutes.filter((route) => !route.startsWith("/hifi/"));
}

for (const framework of frameworks) {
  await runFramework(framework, routesForFramework(framework), suiteSupportForFramework(framework));
}

if (failures.length) {
  console.error(`\nContract tests failed (${failures.length}).`);
  process.exit(1);
}

console.log("\nContract tests passed.");
