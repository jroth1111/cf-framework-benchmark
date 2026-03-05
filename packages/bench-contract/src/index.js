import {
  chartSymbols,
  generateCandles,
  getListing,
  queryListings,
  queryMedia,
} from "@cf-bench/dataset";

const SUITES = ["mpa_airbnb", "spa_trading_media"];
const CACHE = {
  noStore: "no-store",
  short: "public, max-age=0, s-maxage=60",
  detail: "public, max-age=0, s-maxage=300",
};

function toUrl(input) {
  if (input instanceof URL) return input;
  if (input instanceof Request) return new URL(input.url);
  if (typeof input === "string") return new URL(input, "https://cf-bench.local");
  return new URL("https://cf-bench.local");
}

function getIsolateId() {
  const g = globalThis;
  if (!g.__CF_BENCH_ISOLATE_ID) {
    g.__CF_BENCH_ISOLATE_ID = crypto.randomUUID();
  }
  return g.__CF_BENCH_ISOLATE_ID;
}

function withServerTiming(headers, start) {
  const h = new Headers(headers || {});
  const dur = typeof start === "number" ? performance.now() - start : null;
  if (!h.has("server-timing")) {
    if (dur == null) {
      h.set("server-timing", `cf_bench;desc="${getIsolateId()}"`);
    } else {
      h.set("server-timing", `cf_bench;dur=${dur.toFixed(1)};desc="${getIsolateId()}"`);
    }
  }
  return h;
}

export function json(data, options = {}) {
  const { status = 200, cacheControl = null, headers = null, start = null } = options;
  const h = withServerTiming(headers, start);
  h.set("content-type", "application/json; charset=utf-8");
  if (cacheControl) h.set("cache-control", cacheControl);
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function parseIntParam(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
  const minPrice = parseIntParam(url.searchParams.get("minPrice"), undefined);
  const maxPrice = parseIntParam(url.searchParams.get("maxPrice"), undefined);
  const guests = parseIntParam(url.searchParams.get("guests"), undefined);
  const page = parseIntParam(url.searchParams.get("page"), 1);
  const pageSize = parseIntParam(url.searchParams.get("pageSize"), 20);

  return json(
    queryListings({
      city,
      minPrice,
      maxPrice,
      guests,
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

