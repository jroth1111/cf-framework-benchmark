import fs from "node:fs/promises";
import path from "node:path";
import { blogPosts, listings } from "../packages/dataset/src/index.js";

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function normalizeFrameworks(frameworks) {
  if (Array.isArray(frameworks)) return frameworks;
  if (!frameworks) return [];
  return Object.entries(frameworks).map(([name, value]) => {
    if (typeof value === "string") return { name, url: value };
    return { name, ...value };
  });
}

const only = argValue("--only");
const timeoutMs = Number(argValue("--timeout", "12000"));

const cfgPath = path.join(process.cwd(), "bench", "bench.config.json");
const cfg = JSON.parse(await fs.readFile(cfgPath, "utf8"));

let frameworks = normalizeFrameworks(cfg.frameworks);
if (only) {
  const allow = new Set(only.split(",").map((s) => s.trim()).filter(Boolean));
  frameworks = frameworks.filter((f) => allow.has(f.name));
}

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
  expect(value.toLowerCase().includes(expected), `${label} missing ${name} contains ${expected} (got: ${value || "<empty>"})`);
}

function countMatches(value, regex) {
  const matches = value.match(regex);
  return matches ? matches.length : 0;
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

  let body;
  try {
    const text = await res.text();
    body = text ? JSON.parse(text) : null;
  } catch (err) {
    fail(`${label} JSON parse failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }

  return { res, body };
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

const cityCounts = listings.reduce((acc, l) => {
  acc.set(l.city, (acc.get(l.city) || 0) + 1);
  return acc;
}, new Map());
const staysTestCity = [...cityCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || listings[0]?.city || "";
const staysExpectedCount = staysTestCity ? cityCounts.get(staysTestCity) || 0 : 0;
const blogTestSlug = blogPosts[0]?.slug || "";

async function runFramework(framework) {
  const baseUrl = (framework.url || "").replace(/\/$/, "");
  if (!baseUrl) {
    fail(`${framework.name}: missing url`);
    return;
  }

  console.log(`\n${framework.name}`);

  const bench = await fetchJson(`${framework.name} /api/bench`, `${baseUrl}/api/bench`, 200);
  if (bench) {
    expectHeaderIncludes(bench.res, "cache-control", "no-store", `${framework.name} /api/bench`);
    expect(typeof bench.body?.isolateId === "string", `${framework.name} /api/bench isolateId missing`);
    expect(typeof bench.body?.hits === "number", `${framework.name} /api/bench hits missing`);
    expect(typeof bench.body?.now === "number", `${framework.name} /api/bench now missing`);
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
    expect(typeof listingsRes.body?.page === "number", `${framework.name} /api/listings page missing`);
    expect(typeof listingsRes.body?.pageSize === "number", `${framework.name} /api/listings pageSize missing`);
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

  const prices = await fetchJson(`${framework.name} /api/prices`, `${baseUrl}/api/prices?symbol=BTC&timeframe=1h&points=120`, 200);
  if (prices) {
    expectHeaderIncludes(prices.res, "cache-control", "s-maxage=60", `${framework.name} /api/prices`);
    expect(prices.body?.symbol === "BTC", `${framework.name} /api/prices symbol mismatch`);
    expect(Array.isArray(prices.body?.candles), `${framework.name} /api/prices candles missing`);
  }

  const pricesBad = await fetchJson(`${framework.name} /api/prices?bad`, `${baseUrl}/api/prices?symbol=BAD`, 400);
  if (pricesBad) {
    expectHeaderIncludes(pricesBad.res, "cache-control", "no-store", `${framework.name} /api/prices bad`);
    expect(pricesBad.body?.error === "unknown_symbol", `${framework.name} /api/prices bad error mismatch`);
  }

  const rendering = framework.rendering || {};

  if (rendering.stays === "ssr" && staysTestCity) {
    const stays = await fetchHtml(
      `${framework.name} /stays?city=${staysTestCity}`,
      `${baseUrl}/stays?city=${encodeURIComponent(staysTestCity)}`
    );
    if (stays) {
      const count = countMatches(stays.text, /data-testid=["']stay-card["']/g);
      expect(
        count === staysExpectedCount,
        `${framework.name} /stays?city=${staysTestCity} expected ${staysExpectedCount} stay cards, got ${count}`
      );
    }
  }

  if ((rendering.blog === "ssg" || rendering.blog === "ssr") && blogTestSlug) {
    const blogIndex = await fetchHtml(`${framework.name} /blog`, `${baseUrl}/blog`);
    if (blogIndex) {
      const count = countMatches(blogIndex.text, /data-testid=["']blog-post-card["']/g);
      expect(count > 0, `${framework.name} /blog missing blog-post-card markers`);
    }
    const blogPost = await fetchHtml(`${framework.name} /blog/${blogTestSlug}`, `${baseUrl}/blog/${blogTestSlug}`);
    if (blogPost) {
      expect(/data-testid=["']blog-html["']/.test(blogPost.text), `${framework.name} /blog/${blogTestSlug} missing blog-html marker`);
    }
  }
}

if (!frameworks.length) {
  console.error("No frameworks found in bench.config.json");
  process.exit(1);
}

for (const framework of frameworks) {
  await runFramework(framework);
}

if (failures.length) {
  console.error(`\nContract tests failed (${failures.length}).`);
  process.exit(1);
}

console.log("\nContract tests passed.");
