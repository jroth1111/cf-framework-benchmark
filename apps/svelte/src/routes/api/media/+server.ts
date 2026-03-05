import { queryMedia } from "@cf-bench/dataset";

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

function json(data: unknown, init?: ResponseInit, start?: number) {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  if (!headers.has("cache-control")) headers.set("cache-control", "public, max-age=0, s-maxage=60");
  headers.set("server-timing", serverTiming(start ?? performance.now()));
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function GET({ url }: { url: URL }) {
  const start = performance.now();
  const channel = url.searchParams.get("channel") || "";
  const page = Number(url.searchParams.get("page") || "1");
  const pageSize = Number(url.searchParams.get("pageSize") || "20");

  return json(
    queryMedia({
      channel,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    }),
    undefined,
    start
  );
}
