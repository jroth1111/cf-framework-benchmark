import { queryMedia } from "@cf-bench/dataset";

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

export function GET({ request }: { request: Request }) {
  const start = performance.now();
  const url = new URL(request.url);
  const channel = url.searchParams.get("channel") || "";
  const page = Number(url.searchParams.get("page") || "1");
  const pageSize = Number(url.searchParams.get("pageSize") || "20");

  const payload = queryMedia({
    channel,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
  });

  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=60",
      "server-timing": serverTiming(start),
    },
  });
}
