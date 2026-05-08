#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCloudflareAudit } from "./cloudflare-config-audit.mjs";
import { blogPosts, listings } from "../packages/dataset/src/index.js";
import { apiCacheHeader, htmlCacheHeader } from "../packages/bench-cache/src/index.js";
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

function resolveStaticSample(staticSample, route) {
  if (typeof staticSample === "string") return staticSample;
  if (staticSample && typeof staticSample === "object" && typeof staticSample.from === "string") {
    const match = /^dataset\.(\w+)\[(\d+)\]\.(\w+)$/.exec(staticSample.from);
    if (!match) return route;
    const [, collection, idxStr, field] = match;
    const ds = { blogPosts, listings };
    const val = ds[collection]?.[Number(idxStr)]?.[field];
    return val != null ? route.replace(/:([^/]+)/, String(val)) : route;
  }
  return route;
}

export function routeSample(route) {
  const entry = ROUTES_BY_PATH.get(route);
  if (!entry) return route;
  return resolveStaticSample(entry.staticSample, route);
}

export function routeSamples(route) {
  const sample = routeSample(route);
  if (sample === "/") return [sample];
  if (route === "/chart" || route === "/media") return [sample];
  return [sample, `${sample}/`];
}

export function requiredTestIdsForRoute(route) {
  return ROUTES_BY_PATH.get(route)?.requiredTestIds ?? [];
}

export function expectedHtmlCache(route) {
  // Probes send x-cf-bench-profile=idiomatic; bench-cache emits the canonical
  // (preserved) HTML cache value for that profile. Single source: @cf-bench/bench-cache.
  if (!ROUTES_BY_PATH.get(route) || ROUTES_BY_PATH.get(route)?.kind !== "html") return null;
  return htmlCacheHeader(route, "idiomatic");
}

export function expectedApiCache(route) {
  return apiCacheHeader(route);
}

function hasTestId(html, id) {
  const marker = String(id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`data-testid=["']${marker}["']`).test(html);
}

function hasScriptHydrationEvidence(html) {
  return /<script\b/i.test(html);
}

export function expectedDatasetContent(route) {
  const source = ROUTES_BY_PATH.get(route)?.expectedDatasetSource;
  if (source === "listings") return [listings[0]?.title].filter(Boolean);
  if (source === "blogPosts") return [blogPosts[0]?.title].filter(Boolean);
  return [];
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

function routeContractForFramework(framework, suiteByRoute, route) {
  const suiteScenario = suiteByRoute.get(route);
  if (!suiteScenario) return null;
  return framework.matrix?.scenarioContracts?.[suiteScenario.suiteId]?.[suiteScenario.scenarioName] ?? null;
}

function shouldRequireFrameworkHydration(framework, contract) {
  const tier = String(framework.matrix?.tier || "");
  return tier.startsWith("framework-") && contract?.hydrationModel === "framework";
}

async function probeHtml({ framework, baseUrl, route, path, suiteByRoute }) {
  const url = `${baseUrl}${path}`;
  const expectedCache = expectedHtmlCache(route);
  const requiredTestIds = requiredTestIdsForRoute(route);
  const routeContract = routeContractForFramework(framework, suiteByRoute, route);
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
    return { framework: framework.name, route, path, url, status, headers, checks, ok: false };
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
      ok: headers["cache-control"] === expectedCache,
      detail: headers["cache-control"],
    });
  }
  for (const testId of requiredTestIds) {
    checks.push({ name: `selector:${testId}`, ok: hasTestId(text, testId), detail: testId });
  }
  if (shouldRequireFrameworkHydration(framework, routeContract)) {
    checks.push({
      name: "hydration:script-evidence",
      ok: hasScriptHydrationEvidence(text),
      detail: routeContract?.hydrationModel || "unknown",
    });
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
    framework: framework.name,
    route,
    path,
    url,
    status,
    headers,
    requiredTestIds,
    routeContract,
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

async function probeApi({ framework, baseUrl, path, expectedStatus = 200, expectedApiCache = null }) {
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
  if (expectedApiCache !== null) {
    checks.push({
      name: "cache-control",
      ok: headers["cache-control"] === expectedApiCache,
      detail: headers["cache-control"],
    });
  }

  return { framework, path, url, status, headers, bodyShape: body ? Object.keys(body).sort() : [], ok: checks.every((check) => check.ok), checks };
}

export function frameworkSupportsHifi(framework) {
  return framework?.matrix?.hifi?.enabled === true;
}

export function routesForFramework(framework, requiredRoutes) {
  if (frameworkSupportsHifi(framework)) return requiredRoutes;
  return requiredRoutes.filter((route) => !route.startsWith("/hifi/"));
}

export async function main() {
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
  const cloudflareAudit = await buildCloudflareAudit({ cwd: path.resolve(path.dirname(matrixPath), ".."), matrixPath });
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

    for (const route of routesForFramework(framework, requiredRoutes)) {
      for (const sample of routeSamples(route)) {
        routes.push(await probeHtml({ framework, baseUrl, route, path: sample, suiteByRoute }));
      }
    }
    routes.push(await probeUnknownRoute({ framework: framework.name, baseUrl }));

    for (const apiRoute of CONTRACTS.routes.filter((r) => r.kind === "api")) {
      const sample = resolveStaticSample(apiRoute.staticSample, apiRoute.route);
      api.push(await probeApi({ framework: framework.name, baseUrl, path: sample, expectedApiCache: apiRoute.expectedApiCache }));
    }

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
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
