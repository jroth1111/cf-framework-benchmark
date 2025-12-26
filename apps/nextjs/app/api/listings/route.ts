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
  const city = url.searchParams.get("city") || "";
  const max = url.searchParams.get("max");
  const sort = (url.searchParams.get("sort") || "relevance") as any;
  const page = Number(url.searchParams.get("page") || "1");
  const pageSize = Number(url.searchParams.get("pageSize") || "24");
  const maxNum = max ? Number(max) : undefined;

  return json(
    queryListings({
      city,
      max: Number.isFinite(maxNum) ? maxNum : undefined,
      sort,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 24,
    }),
    undefined,
    start
  );
}
