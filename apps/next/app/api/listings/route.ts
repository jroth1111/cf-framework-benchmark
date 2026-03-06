import { queryListings } from "@cf-bench/dataset";

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

function parseIntParam(value: string | null, fallback: number): number;
function parseIntParam(value: string | null, fallback: undefined): number | undefined;
function parseIntParam(value: string | null, fallback: number | undefined) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(req: Request) {
  const start = performance.now();
  const url = new URL(req.url);
  const max = parseIntParam(url.searchParams.get("max"), undefined);
  const sort = (url.searchParams.get("sort") || "relevance") as
    | "relevance"
    | "price_asc"
    | "price_desc"
    | "rating_desc";

  return json(
    queryListings({
      city: url.searchParams.get("city") || "",
      max,
      sort,
      page: parseIntParam(url.searchParams.get("page"), 1),
      pageSize: parseIntParam(url.searchParams.get("pageSize"), 20),
    }),
    undefined,
    start
  );
}
