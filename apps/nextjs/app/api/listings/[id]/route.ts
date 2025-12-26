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
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  const id = segments[segments.length - 1] ?? "";
  const l = getListing(id);
  if (!l) return json({ error: "not_found" }, { status: 404, headers: { "cache-control": "no-store" } }, start);
  return json(
    { listing: l },
    { headers: { "cache-control": "public, max-age=0, s-maxage=300" } },
    start
  );
}
