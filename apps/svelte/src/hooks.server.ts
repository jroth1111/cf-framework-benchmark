import type { Handle } from "@sveltejs/kit";
import { htmlCacheHeaderForPath } from "@cf-bench/bench-cache";

function getIsolateId() {
  const globalAny = globalThis as Record<string, unknown>;
  if (typeof globalAny.__CF_BENCH_ISOLATE_ID !== "string") {
    globalAny.__CF_BENCH_ISOLATE_ID = crypto.randomUUID();
  }
  return globalAny.__CF_BENCH_ISOLATE_ID as string;
}

export const handle: Handle = async ({ event, resolve }) => {
  const start = performance.now();
  const response = await resolve(event);
  if (!event.url.pathname.startsWith("/api/")) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const profile = event.request.headers.get("x-cf-bench-profile");
      response.headers.set(
        "cache-control",
        htmlCacheHeaderForPath(event.url.pathname, profile)
      );
      if (!response.headers.has("server-timing")) {
        response.headers.set(
          "server-timing",
          `cf_bench;dur=${(performance.now() - start).toFixed(1)};desc="${getIsolateId()}"`
        );
      }
    }
  }
  return response;
};
