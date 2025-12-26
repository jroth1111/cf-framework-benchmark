import { createFileRoute } from "@tanstack/react-router";

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

export const Route = createFileRoute("/api/bench")({
  server: {
    handlers: {
      GET: async () => {
        const start = performance.now();
        (globalThis as any).__CF_BENCH_ISOLATE_HITS = ((globalThis as any).__CF_BENCH_ISOLATE_HITS ?? 0) + 1;
        return new Response(
          JSON.stringify({
            isolateId: getIsolateId(),
            hits: (globalThis as any).__CF_BENCH_ISOLATE_HITS,
            now: Date.now(),
          }),
          {
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
              "server-timing": serverTiming(start),
            },
          }
        );
      },
    },
  },
});
