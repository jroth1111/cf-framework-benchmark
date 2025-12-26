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

export async function GET({ url }: { url: URL }) {
  const start = performance.now();
  const symbol = (url.searchParams.get("symbol") || "BTC").toUpperCase();
  const timeframe = url.searchParams.get("timeframe") || "1h";
  const points = Number(url.searchParams.get("points") || "360");

  if (!chartSymbols.includes(symbol)) {
    return new Response(JSON.stringify({ error: "unknown_symbol" }), {
      status: 400,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "server-timing": serverTiming(start),
      },
    });
  }

  const candles = generateCandles(symbol, {
    timeframe,
    points: Number.isFinite(points) ? Math.max(60, Math.min(2000, points)) : 360,
  });

  return new Response(JSON.stringify({ symbol, timeframe, candles }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=60",
      "server-timing": serverTiming(start),
    },
  });
}
