// Sole source of cache-control header values across the repo. Reads canonical
// idiomatic-profile values from contracts/v5.json. The parity profile downgrades
// non-hifi cacheable HTML routes to no-store; hifi routes always emit the rich
// header (the hifi suite measures cached responses).
import contracts from "../../../contracts/v5.json" with { type: "json" };
import profilesCatalog from "../../../bench/profiles.json" with { type: "json" };

export const NO_STORE = "no-store";

// SDK fixtures (`/__bench/sdk/*.js`) have a uniform long-TTL cache contract.
// Declared per-route in contracts/v5.json as `kind: "sdk-fixture"` with
// expectedApiCache matching this value. test-contract-api-cache verifies parity.
export const SDK_CACHE_HEADER = "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

const ROUTES_BY_PATH = new Map(contracts.routes.map((r) => [r.route, r]));

const HTML_PROFILES_THAT_PRESERVE_CACHE = new Set(
  profilesCatalog.profiles
    .filter((p) => p.htmlCachePolicy === "preserve")
    .map((p) => p.id)
);

function isHifiRoute(routeId) {
  return typeof routeId === "string" && routeId.startsWith("/hifi/");
}

export function htmlCacheHeader(routeId, profile = null) {
  const route = ROUTES_BY_PATH.get(routeId);
  if (!route || route.kind !== "html") {
    throw new Error(`htmlCacheHeader: unknown HTML route ${routeId}`);
  }
  const expected = route.expectedHtmlCache;
  if (typeof expected !== "string" || expected === NO_STORE) return NO_STORE;
  if (isHifiRoute(routeId)) return expected;
  if (HTML_PROFILES_THAT_PRESERVE_CACHE.has(profile)) return expected;
  return NO_STORE;
}

export function apiCacheHeader(routeId) {
  const route = ROUTES_BY_PATH.get(routeId);
  if (!route || route.kind !== "api") {
    throw new Error(`apiCacheHeader: unknown API route ${routeId}`);
  }
  const value = route.expectedApiCache;
  if (typeof value !== "string") {
    throw new Error(`apiCacheHeader: ${routeId} missing expectedApiCache`);
  }
  return value;
}

export function errorApiCacheHeader(routeId = null) {
  if (typeof routeId === "string") {
    const route = ROUTES_BY_PATH.get(routeId);
    if (route && typeof route.expectedErrorApiCache === "string") return route.expectedErrorApiCache;
  }
  return NO_STORE;
}

export function classifyHtmlRoute(pathname) {
  const normalized = String(pathname || "").replace(/\/+$/, "") || "/";
  if (normalized === "/") return "/";
  if (normalized === "/stays") return "/stays";
  if (normalized === "/blog") return "/blog";
  if (normalized === "/chart") return "/chart";
  if (normalized === "/media") return "/media";
  if (normalized === "/hifi/stays") return "/hifi/stays";
  if (/^\/hifi\/stays\/[^/]+$/.test(normalized)) return "/hifi/stays/:id";
  if (/^\/stays\/[^/]+$/.test(normalized)) return "/stays/:id";
  if (/^\/blog\/[^/]+$/.test(normalized)) return "/blog/:slug";
  return null;
}

export function htmlCacheHeaderForPath(pathname, profile = null) {
  const routeId = classifyHtmlRoute(pathname);
  if (!routeId) return NO_STORE;
  return htmlCacheHeader(routeId, profile);
}

// Used by patcher / build-time generators that need to emit the canonical
// HTML route → cache-control mapping inline (e.g. into a generated worker.js
// bundle that cannot import workspace packages).
export function htmlCacheHeaderTable() {
  const table = {};
  for (const route of contracts.routes) {
    if (route.kind === "html" && typeof route.expectedHtmlCache === "string") {
      table[route.route] = route.expectedHtmlCache;
    }
  }
  return table;
}
