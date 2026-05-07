import type { Handle } from "@sveltejs/kit";
import { benchCacheHeader } from "$lib/bench-cache";

function benchmarkPageKind(pathname: string) {
  if (pathname === "/stays" || pathname === "/blog") return "list";
  if (pathname === "/hifi/stays") return "list";
  if (/^\/hifi\/stays\/[^/]+$/.test(pathname)) return "detail";
  if (/^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname)) return "detail";
  return null;
}

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
      const kind = benchmarkPageKind(event.url.pathname);
      const cache =
        kind && benchCacheHeader(event.request.headers.get("x-cf-bench-profile"), kind);

      response.headers.set("cache-control", cache ?? "no-store");
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
