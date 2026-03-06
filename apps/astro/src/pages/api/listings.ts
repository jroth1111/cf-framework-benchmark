import { queryListings } from "@cf-bench/dataset";

export const prerender = false;

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

function parseIntParam(value: string | null, fallback: number): number;
function parseIntParam(value: string | null, fallback: undefined): number | undefined;
function parseIntParam(value: string | null, fallback: number | undefined) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function GET({ request }: { request: Request }) {
  const start = performance.now();
  const url = new URL(request.url);

  const max = parseIntParam(url.searchParams.get("max"), undefined);
  const sort = (url.searchParams.get("sort") || "relevance") as
    | "relevance"
    | "price_asc"
    | "price_desc"
    | "rating_desc";
  const payload = queryListings({
    city: url.searchParams.get("city") || "",
    max,
    sort,
    page: parseIntParam(url.searchParams.get("page"), 1),
    pageSize: parseIntParam(url.searchParams.get("pageSize"), 20),
  });

  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=60",
      "server-timing": serverTiming(start),
    },
  });
}
