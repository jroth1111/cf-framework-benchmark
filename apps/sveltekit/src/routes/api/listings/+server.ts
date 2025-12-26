import { queryListings } from "@cf-bench/dataset";

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
  const city = url.searchParams.get("city") || "";
  const max = url.searchParams.get("max");
  const sort = (url.searchParams.get("sort") || "relevance") as any;
  const page = Number(url.searchParams.get("page") || "1");
  const pageSize = Number(url.searchParams.get("pageSize") || "24");
  const maxNum = max ? Number(max) : undefined;

  const payload = queryListings({
    city,
    max: Number.isFinite(maxNum) ? maxNum : undefined,
    sort,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 24,
  });

  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=60",
      "server-timing": serverTiming(start),
    },
  });
}
