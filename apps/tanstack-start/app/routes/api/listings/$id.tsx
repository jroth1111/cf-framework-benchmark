import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/api/listings/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const start = performance.now();
        const id = (params as any).id as string;
        const l = getListing(id);
        if (!l) {
          return new Response(JSON.stringify({ error: "not_found" }), {
            status: 404,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
              "server-timing": serverTiming(start),
            },
          });
        }
        return new Response(JSON.stringify({ listing: l }), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=0, s-maxage=300",
            "server-timing": serverTiming(start),
          },
        });
      },
    },
  },
});
