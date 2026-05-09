import {
  chartSymbols,
  generateCandles,
  getListing,
  queryListings,
  queryMedia,
} from "@cf-bench/dataset";
import {
  getIsolateId,
  parseIntParam,
  toUrl,
  withServerTiming,
} from "@cf-bench/bench-utils";
import {
  NO_STORE,
  SDK_CACHE_HEADER,
  apiCacheHeader,
  errorApiCacheHeader,
} from "@cf-bench/bench-cache";
import {
  getAnalyticsSdkSource,
  getMapsSdkSource,
} from "./sdk-fixtures.js";
import { HIFI_SUITE_FRAMEWORKS } from "./hifi-suite-frameworks.generated.js";
import v5Contract from "../../../contracts/v5.json" with { type: "json" };

const _rd = Object.fromEntries(
  (v5Contract.routes ?? []).filter((r) => r.responseDefaults).map((r) => [r.route, r.responseDefaults])
);
const DEFAULT_PAGE_SIZE = _rd["/api/listings"]?.defaultPageSize ?? 20;
const DEFAULT_MEDIA_PAGE_SIZE = _rd["/api/media"]?.defaultPageSize ?? 20;
const DEFAULT_CANDLES = _rd["/api/prices"]?.defaultCandles ?? 360;

export { HIFI_SUITE_FRAMEWORKS };

const BASE_SUITES = ["mpa_airbnb", "spa_trading_media"];
const HIFI_SUITE = "mpa_airbnb_hifi";
const HIFI_SUITE_FRAMEWORK_SET = new Set(HIFI_SUITE_FRAMEWORKS);
export { parseIntParam } from "@cf-bench/bench-utils";

export function suiteSupportForFramework(framework) {
  if (typeof framework !== "string" || framework.trim() === "") {
    throw new Error("suiteSupportForFramework: framework must be a non-empty string.");
  }
  const normalized = framework.toLowerCase();
  return HIFI_SUITE_FRAMEWORK_SET.has(normalized) ? [...BASE_SUITES, HIFI_SUITE] : [...BASE_SUITES];
}

export function json(data, options = {}) {
  const { status = 200, cacheControl = null, headers = null, start = null } = options;
  const h = withServerTiming(headers, start);
  h.set("content-type", "application/json; charset=utf-8");
  if (cacheControl) h.set("cache-control", cacheControl);
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function handleBench(framework) {
  if (typeof framework !== "string" || framework.trim() === "") {
    throw new Error("handleBench: framework must be a non-empty string identifying the app.");
  }
  const start = performance.now();
  const g = globalThis;
  g.__CF_BENCH_ISOLATE_HITS = (g.__CF_BENCH_ISOLATE_HITS ?? 0) + 1;
  return json(
    {
      isolateId: getIsolateId(),
      hits: g.__CF_BENCH_ISOLATE_HITS,
      now: Date.now(),
      runtime: "cloudflare-workers",
      framework,
      contractVersion: v5Contract.contractVersion,
      suiteSupport: suiteSupportForFramework(framework),
    },
    { cacheControl: apiCacheHeader("/api/bench"), start }
  );
}

export function handleHealth() {
  const start = performance.now();
  return json({ ok: true, ts: Date.now() }, { cacheControl: apiCacheHeader("/api/health"), start });
}

export function handleListings(input) {
  const start = performance.now();
  const url = toUrl(input);
  const city = url.searchParams.get("city") || "";
  const max = parseIntParam(url.searchParams.get("max"), undefined);
  const sort = url.searchParams.get("sort") || "relevance";
  const page = parseIntParam(url.searchParams.get("page"), 1);
  const pageSize = parseIntParam(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);

  return json(
    queryListings({
      city,
      max,
      sort,
      page,
      pageSize,
    }),
    { cacheControl: apiCacheHeader("/api/listings"), start }
  );
}

export function handleListing(id) {
  const start = performance.now();
  const listing = getListing(id);
  if (!listing) {
    return json({ error: "not_found" }, { status: 404, cacheControl: errorApiCacheHeader("/api/listings/:id"), start });
  }
  return json({ listing }, { cacheControl: apiCacheHeader("/api/listings/:id"), start });
}

export function handlePrices(input) {
  const start = performance.now();
  const url = toUrl(input);
  const symbol = (url.searchParams.get("symbol") || "").toUpperCase() || "BTC";
  const timeframe = url.searchParams.get("timeframe") || "1h";
  const points = parseIntParam(url.searchParams.get("points"), DEFAULT_CANDLES);

  if (!chartSymbols.includes(symbol)) {
    return json({ error: "unknown_symbol" }, { status: 400, cacheControl: errorApiCacheHeader("/api/prices"), start });
  }
  return json(
    {
      symbol,
      timeframe,
      candles: generateCandles(symbol, { timeframe, points }),
    },
    { cacheControl: apiCacheHeader("/api/prices"), start }
  );
}

export function handleMedia(input) {
  const start = performance.now();
  const url = toUrl(input);
  const channel = url.searchParams.get("channel") || "";
  const page = parseIntParam(url.searchParams.get("page"), 1);
  const pageSize = parseIntParam(url.searchParams.get("pageSize"), DEFAULT_MEDIA_PAGE_SIZE);

  return json(queryMedia({ channel, page, pageSize }), { cacheControl: apiCacheHeader("/api/media"), start });
}

function jsResponse(body, start) {
  const headers = withServerTiming(null, start);
  headers.set("content-type", "application/javascript; charset=utf-8");
  headers.set("cache-control", SDK_CACHE_HEADER);
  return new Response(body, { status: 200, headers });
}

export function handleSdkMaps() {
  const start = performance.now();
  return jsResponse(getMapsSdkSource(), start);
}

export function handleSdkAnalytics() {
  const start = performance.now();
  return jsResponse(getAnalyticsSdkSource(), start);
}

export function handleBeacon() {
  const start = performance.now();
  const headers = withServerTiming(null, start);
  headers.set("cache-control", NO_STORE);
  return new Response(null, { status: 204, headers });
}

export function handleContractApi(framework, input) {
  const url = toUrl(input);
  if (url.pathname === "/api/bench") return handleBench(framework);
  if (url.pathname === "/api/health") return handleHealth();
  if (url.pathname === "/api/listings") return handleListings(url);
  if (url.pathname === "/api/prices") return handlePrices(url);
  if (url.pathname === "/api/media") return handleMedia(url);
  if (url.pathname === "/__bench/sdk/maps.js") return handleSdkMaps();
  if (url.pathname === "/__bench/sdk/analytics.js") return handleSdkAnalytics();
  if (url.pathname === "/__bench/beacon") return handleBeacon();
  const listingMatch = url.pathname.match(/^\/api\/listings\/([^/]+)$/);
  if (listingMatch) return handleListing(listingMatch[1]);
  return null;
}
