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
} from "../bench/src/config-v4.mjs";

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
  if (route === "/stays/:id") return "/stays/001";
  if (route === "/blog/:slug") return `/blog/${blogPosts[0]?.slug || "why-this-benchmark-exists"}`;
  return route;
}

function routeSamples(route) {
  const sample = routeSample(route);
  if (sample === "/") return [sample];
  if (route === "/chart" || route === "/media") return [sample];
  return [sample, `${sample}/`];
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

function expectedHtmlCache(route) {
  switch (route) {
    case "/stays":
    case "/blog":
      return "s-maxage=60";
    case "/stays/:id":
    case "/blog/:slug":
      return "s-maxage=300";
    case "/":
    case "/chart":
    case "/media":
      return "no-store";
    default:
      return null;
  }
}

function expectedDatasetContent(route) {
  switch (route) {
    case "/stays":
    case "/stays/:id":
      return [listings[0]?.title].filter(Boolean);
    case "/blog":
    case "/blog/:slug":
      return [blogPosts[0]?.title].filter(Boolean);
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
    expect(listingsRes.body?.pageSize === 1, `${framework.name} /api/listings pageSize mismatch for explicit query`);
  }

  const listingsDefault = await fetchJson(`${framework.name} /api/listings default`, `${baseUrl}/api/listings`, 200);
  if (listingsDefault) {
    expect(listingsDefault.body?.pageSize === 20, `${framework.name} /api/listings default pageSize mismatch`);
    expect(
      listingsDefault.body?.results?.length === 20,
      `${framework.name} /api/listings default result count mismatch`
    );
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
    expect(prices.body?.candles?.length === 120, `${framework.name} /api/prices candles length mismatch`);
  }

  const pricesDefault = await fetchJson(`${framework.name} /api/prices default`, `${baseUrl}/api/prices?symbol=BTC`, 200);
  if (pricesDefault) {
    expect(pricesDefault.body?.candles?.length === 360, `${framework.name} /api/prices default candles mismatch`);
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
    expect(media.body?.pageSize === 3, `${framework.name} /api/media pageSize mismatch for explicit query`);
  }

  const mediaDefault = await fetchJson(`${framework.name} /api/media default`, `${baseUrl}/api/media`, 200);
  if (mediaDefault) {
    expect(mediaDefault.body?.pageSize === 20, `${framework.name} /api/media default pageSize mismatch`);
    expect(
      mediaDefault.body?.results?.length === 20,
      `${framework.name} /api/media default result count mismatch`
    );
  }

  for (const route of requiredRoutes) {
    for (const sample of routeSamples(route)) {
      const page = await fetchHtml(`${framework.name} ${sample}`, `${baseUrl}${sample}`);
      if (!page) continue;

      const expectedCache = expectedHtmlCache(route);
      if (expectedCache) {
        expectHeaderIncludes(page.res, "cache-control", expectedCache, `${framework.name} ${sample}`);
      }

      for (const marker of requiredTestIdsForRoute(route)) {
        expect(hasTestId(page.text, marker), `${framework.name} ${sample} missing data-testid=${marker}`);
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
