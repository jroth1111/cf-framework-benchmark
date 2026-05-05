#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { buildCloudflareAudit } from "./cloudflare-config-audit.mjs";
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

function hasFlag(flag) {
  return process.argv.includes(flag);
}

const timeoutMs = Number(argValue("--timeout", "12000"));
const outPath = argValue("--out", "bench/contract-report.json");
const only = parseCsvSet(argValue("--only", ""));
const suiteNames = parseCsvSet(argValue("--suites", "mpa_airbnb,spa_trading_media"));
const targetsPath = toAbsolutePath(argValue("--targets", null), DEFAULT_TARGETS_PATH);
const matrixPath = toAbsolutePath(argValue("--matrix", null), DEFAULT_MATRIX_PATH);
const suitesDir = toAbsolutePath(argValue("--suites-dir", null), DEFAULT_SUITES_DIR);
const failOnViolations = hasFlag("--fail-on-violations");

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

function hasTestId(html, id) {
  const marker = String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`data-testid=["']${marker}["']`).test(html);
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

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function probeHtml({ framework, baseUrl, route, path }) {
  const url = `${baseUrl}${path}`;
  const expectedCache = expectedHtmlCache(route);
  const requiredTestIds = requiredTestIdsForRoute(route);
  const checks = [];
  let status = null;
  let headers = {};
  let text = "";

  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        accept: "text/html",
        "x-cf-bench-profile": "idiomatic",
      },
    });
    status = res.status;
    headers = {
      "content-type": res.headers.get("content-type") || "",
      "cache-control": res.headers.get("cache-control") || "",
      "server-timing": res.headers.get("server-timing") || "",
      "cf-ray": res.headers.get("cf-ray") || "",
      link: res.headers.get("link") || "",
    };
    text = await res.text();
  } catch (err) {
    checks.push({ name: "request", ok: false, detail: err instanceof Error ? err.message : String(err) });
    return { framework, route, path, url, status, headers, checks, ok: false };
  }

  checks.push({ name: "status", ok: status >= 200 && status < 400, detail: String(status) });
  checks.push({
    name: "content-type",
    ok: headers["content-type"].toLowerCase().includes("text/html"),
    detail: headers["content-type"],
  });
  checks.push({
    name: "server-timing",
    ok: headers["server-timing"].toLowerCase().includes("cf_bench"),
    detail: headers["server-timing"],
  });
  if (expectedCache) {
    checks.push({
      name: "cache-control",
      ok: headers["cache-control"].toLowerCase().includes(expectedCache),
      detail: headers["cache-control"],
    });
  }
  for (const testId of requiredTestIds) {
    checks.push({ name: `selector:${testId}`, ok: hasTestId(text, testId), detail: testId });
  }
  for (const expected of expectedDatasetContent(route)) {
    checks.push({
      name: `dataset-content:${expected}`,
      ok: text.includes(expected),
      detail: expected,
    });
  }
  checks.push({
    name: "html-body-size",
    ok: text.length > 500,
    detail: String(text.length),
  });

  return {
    framework,
    route,
    path,
    url,
    status,
    headers,
    requiredTestIds,
    ok: checks.every((check) => check.ok),
    checks,
  };
}

async function probeUnknownRoute({ framework, baseUrl }) {
  const path = "/__cf_bench_missing_contract_route";
  const url = `${baseUrl}${path}`;
  const checks = [];
  let status = null;
  let headers = {};

  try {
    const res = await fetchWithTimeout(url, { headers: { accept: "text/html" } });
    status = res.status;
    headers = {
      "content-type": res.headers.get("content-type") || "",
      "cache-control": res.headers.get("cache-control") || "",
      "server-timing": res.headers.get("server-timing") || "",
      "cf-ray": res.headers.get("cf-ray") || "",
      link: res.headers.get("link") || "",
    };
    await res.arrayBuffer();
  } catch (err) {
    checks.push({ name: "request", ok: false, detail: err instanceof Error ? err.message : String(err) });
    return { framework, path, url, status, headers, checks, ok: false };
  }

  checks.push({
    name: "unknown-route-status",
    ok: status === 404,
    detail: String(status),
  });
  return { framework, path, url, status, headers, checks, ok: checks.every((check) => check.ok) };
}

async function probeApi({ framework, baseUrl, path, expectedStatus = 200 }) {
  const url = `${baseUrl}${path}`;
  const checks = [];
  let status = null;
  let headers = {};
  let body = null;

  try {
    const res = await fetchWithTimeout(url, { headers: { accept: "application/json" } });
    status = res.status;
    headers = {
      "content-type": res.headers.get("content-type") || "",
      "cache-control": res.headers.get("cache-control") || "",
      "server-timing": res.headers.get("server-timing") || "",
      link: res.headers.get("link") || "",
    };
    const text = await res.text();
    body = text ? JSON.parse(text) : null;
  } catch (err) {
    checks.push({ name: "request", ok: false, detail: err instanceof Error ? err.message : String(err) });
    return { framework, path, url, status, headers, checks, ok: false };
  }

  checks.push({ name: "status", ok: status === expectedStatus, detail: String(status) });
  checks.push({
    name: "content-type",
    ok: headers["content-type"].toLowerCase().includes("application/json"),
    detail: headers["content-type"],
  });
  checks.push({
    name: "server-timing",
    ok: headers["server-timing"].toLowerCase().includes("cf_bench"),
    detail: headers["server-timing"],
  });

  return { framework, path, url, status, headers, bodyShape: body ? Object.keys(body).sort() : [], ok: checks.every((check) => check.ok), checks };
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
const cloudflareAudit = await buildCloudflareAudit({ matrixPath });
const cloudflareByName = new Map(cloudflareAudit.frameworks.map((row) => [row.name, row]));

const report = {
  schemaVersion: "1.0.0",
  contractVersion: "v5",
  generatedAt: new Date().toISOString(),
  matrixPath,
  targetsPath,
  suites: [...suiteNames],
  cloudflareAudit: {
    ok: cloudflareAudit.ok,
    gapCount: cloudflareAudit.gapCount,
    metadataPath: cloudflareAudit.metadataPath,
  },
  frameworks: [],
};

for (const framework of frameworks) {
  const baseUrl = framework.url.replace(/\/$/, "");
  const routes = [];
  const api = [];

  for (const route of requiredRoutes) {
    for (const sample of routeSamples(route)) {
      routes.push(await probeHtml({ framework: framework.name, baseUrl, route, path: sample }));
    }
  }
  routes.push(await probeUnknownRoute({ framework: framework.name, baseUrl }));

  api.push(await probeApi({ framework: framework.name, baseUrl, path: "/api/bench" }));
  api.push(await probeApi({ framework: framework.name, baseUrl, path: "/api/listings?pageSize=1" }));
  api.push(await probeApi({ framework: framework.name, baseUrl, path: "/api/prices?symbol=BTC&timeframe=1h&points=120" }));
  api.push(await probeApi({ framework: framework.name, baseUrl, path: "/api/media?pageSize=3" }));

  const ok = routes.every((route) => route.ok) && api.every((endpoint) => endpoint.ok);
  report.frameworks.push({
    name: framework.name,
    tier: framework.matrix?.tier || null,
    implementationKind: framework.matrix?.implementationKind || null,
    url: baseUrl,
    cloudflare: cloudflareByName.get(framework.name) ?? null,
    ok,
    routes,
    api,
  });
  console.log(`${ok ? "ok" : "fail"} ${framework.name}`);
}

report.ok = cloudflareAudit.ok && report.frameworks.every((framework) => framework.ok);
report.failureCount = report.frameworks.reduce(
  (sum, framework) =>
    sum +
    framework.routes.flatMap((route) => route.checks).filter((check) => !check.ok).length +
    framework.api.flatMap((endpoint) => endpoint.checks).filter((check) => !check.ok).length,
  cloudflareAudit.gapCount
);

const resolvedOutPath = path.resolve(outPath);
await fs.mkdir(path.dirname(resolvedOutPath), { recursive: true });
await fs.writeFile(resolvedOutPath, JSON.stringify(report, null, 2));
console.log(`Contract report written to ${outPath}`);

if (failOnViolations && !report.ok) {
  console.error(`Contract report failed with ${report.failureCount} failed checks.`);
  process.exit(1);
}
