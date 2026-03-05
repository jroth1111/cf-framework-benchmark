import type { RequestHandler } from "@qwik.dev/router";
import { getListing } from "@cf-bench/dataset";

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

export const onGet: RequestHandler = async ({ params, json, headers }) => {
  const start = performance.now();
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("server-timing", serverTiming(start));

  const listing = getListing(params.id ?? "");
  if (!listing) {
    headers.set("cache-control", "no-store");
    json(404, { error: "not_found" });
    return;
  }

  headers.set("cache-control", "public, max-age=0, s-maxage=300");
  json(200, { listing });
};
