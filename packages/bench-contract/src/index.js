import {
  chartSymbols,
  generateCandles,
  getListing,
  queryListings,
  queryMedia,
} from "@cf-bench/dataset";
import {
  CACHE,
  parseIntParam,
  toUrl,
  withServerTiming,
} from "@cf-bench/bench-utils";

const SUITES = ["mpa_airbnb", "spa_trading_media"];
export { parseIntParam } from "@cf-bench/bench-utils";

export function json(data, options = {}) {
  const { status = 200, cacheControl = null, headers = null, start = null } = options;
  const h = withServerTiming(headers, start);
  h.set("content-type", "application/json; charset=utf-8");
  if (cacheControl) h.set("cache-control", cacheControl);
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function handleBench(framework) {
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
      contractVersion: "v3.0.0",
      suiteSupport: SUITES,
    },
    { cacheControl: CACHE.noStore, start }
  );
}

export function handleHealth() {
  const start = performance.now();
  return json({ ok: true, ts: Date.now() }, { cacheControl: CACHE.noStore, start });
}

export function handleListings(input) {
  const start = performance.now();
  const url = toUrl(input);
  const city = url.searchParams.get("city") || "";
  const max = parseIntParam(url.searchParams.get("max"), undefined);
  const sort = url.searchParams.get("sort") || "relevance";
  const page = parseIntParam(url.searchParams.get("page"), 1);
  const pageSize = parseIntParam(url.searchParams.get("pageSize"), 20);

  return json(
    queryListings({
      city,
      max,
      sort,
      page,
      pageSize,
    }),
    { cacheControl: CACHE.short, start }
  );
}

export function handleListing(id) {
  const start = performance.now();
  const listing = getListing(id);
  if (!listing) {
    return json({ error: "not_found" }, { status: 404, cacheControl: CACHE.noStore, start });
  }
  return json({ listing }, { cacheControl: CACHE.detail, start });
}

export function handlePrices(input) {
  const start = performance.now();
  const url = toUrl(input);
  const symbol = (url.searchParams.get("symbol") || "").toUpperCase() || "BTC";
  const timeframe = url.searchParams.get("timeframe") || "1h";
  const points = parseIntParam(url.searchParams.get("points"), 360);

  if (!chartSymbols.includes(symbol)) {
    return json({ error: "unknown_symbol" }, { status: 400, cacheControl: CACHE.noStore, start });
  }
  return json(
    {
      symbol,
      timeframe,
      candles: generateCandles(symbol, { timeframe, points }),
    },
    { cacheControl: CACHE.short, start }
  );
}

export function handleMedia(input) {
  const start = performance.now();
  const url = toUrl(input);
  const channel = url.searchParams.get("channel") || "";
  const page = parseIntParam(url.searchParams.get("page"), 1);
  const pageSize = parseIntParam(url.searchParams.get("pageSize"), 20);

  return json(queryMedia({ channel, page, pageSize }), { cacheControl: CACHE.short, start });
}

export function handleContractApi(framework, input) {
  const url = toUrl(input);
  if (url.pathname === "/api/bench") return handleBench(framework);
  if (url.pathname === "/api/health") return handleHealth();
  if (url.pathname === "/api/listings") return handleListings(url);
  if (url.pathname === "/api/prices") return handlePrices(url);
  if (url.pathname === "/api/media") return handleMedia(url);
  const listingMatch = url.pathname.match(/^\/api\/listings\/([^/]+)$/);
  if (listingMatch) return handleListing(listingMatch[1]);
  return null;
}
