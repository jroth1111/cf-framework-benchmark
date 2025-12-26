import { chartSymbols, generateCandles, getListing, queryListings } from "@cf-bench/dataset";

function getIsolateId() {
  const globalAny = globalThis as any;
  if (!globalAny.__CF_BENCH_ISOLATE_ID) {
    globalAny.__CF_BENCH_ISOLATE_ID = crypto.randomUUID();
  }
  return globalAny.__CF_BENCH_ISOLATE_ID as string;
}

function json(data: unknown, init?: ResponseInit, timingStart?: number) {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  if (!headers.has("cache-control")) headers.set("cache-control", "public, max-age=0, s-maxage=60");
  if (!headers.has("server-timing")) {
    const dur = typeof timingStart === "number" ? performance.now() - timingStart : null;
    headers.set(
      "server-timing",
      dur == null
        ? `cf_bench;desc=\"${getIsolateId()}\"`
        : `cf_bench;dur=${dur.toFixed(1)};desc=\"${getIsolateId()}\"`
    );
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function GET(req: Request) {
  const start = performance.now();
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") || "BTC").toUpperCase();
  const timeframe = url.searchParams.get("timeframe") || "1h";
  const points = Number(url.searchParams.get("points") || "360");

  if (!chartSymbols.includes(symbol)) {
    return json({ error: "unknown_symbol" }, { status: 400, headers: { "cache-control": "no-store" } }, start);
  }

  const candles = generateCandles(symbol, {
    timeframe,
    points: Number.isFinite(points) ? Math.max(60, Math.min(2000, points)) : 360,
  });

  return json(
    { symbol, timeframe, candles },
    { headers: { "cache-control": "public, max-age=0, s-maxage=60" } },
    start
  );
}
