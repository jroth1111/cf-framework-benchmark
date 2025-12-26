import type { RequestHandler } from "@qwik.dev/router";
import { chartSymbols, generateCandles } from "@cf-bench/dataset";

function getIsolateId() {
  const globalAny = globalThis as any;
  if (!globalAny.__CF_BENCH_ISOLATE_ID) {
    globalAny.__CF_BENCH_ISOLATE_ID = crypto.randomUUID();
  }
  return globalAny.__CF_BENCH_ISOLATE_ID as string;
}

function serverTiming(start: number) {
  const dur = performance.now() - start;
  return `cf_bench;dur=${dur.toFixed(1)};desc=\"${getIsolateId()}\"`;
}

export const onGet: RequestHandler = async ({ url, json, headers }) => {
  const start = performance.now();
  headers.set("content-type", "application/json; charset=utf-8");
  const symbol = (url.searchParams.get("symbol") || "BTC").toUpperCase();
  const timeframe = url.searchParams.get("timeframe") || "1h";
  const points = Number(url.searchParams.get("points") || "360");

  if (!chartSymbols.includes(symbol)) {
    headers.set("server-timing", serverTiming(start));
    headers.set("cache-control", "no-store");
    json(400, { error: "unknown_symbol" });
    return;
  }

  const candles = generateCandles(symbol, {
    timeframe,
    points: Number.isFinite(points) ? Math.max(60, Math.min(2000, points)) : 360,
  });

  headers.set("cache-control", "public, max-age=0, s-maxage=60");
  headers.set("server-timing", serverTiming(start));
  json(200, { symbol, timeframe, candles });
};
