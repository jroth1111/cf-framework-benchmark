import type { RequestHandler } from "@qwik.dev/router";

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

export const onGet: RequestHandler = async ({ json, headers }) => {
  const start = performance.now();
  headers.set("content-type", "application/json; charset=utf-8");
  (globalThis as any).__CF_BENCH_ISOLATE_HITS = ((globalThis as any).__CF_BENCH_ISOLATE_HITS ?? 0) + 1;
  headers.set("server-timing", serverTiming(start));
  headers.set("cache-control", "no-store");
  json(200, { isolateId: getIsolateId(), hits: (globalThis as any).__CF_BENCH_ISOLATE_HITS, now: Date.now() });
};
