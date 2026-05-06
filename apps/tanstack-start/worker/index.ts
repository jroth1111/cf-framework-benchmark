import app from "@tanstack/react-start/server-entry";
import { handleContractApi } from "@cf-bench/bench-contract";

const BENCH_PROFILE_HEADER = "x-cf-bench-profile";
const CACHE_LIST = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const CACHE_DETAIL = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";
const CACHE_HIFI_LIST = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const CACHE_HIFI_DETAIL = "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";

type CacheKind = "list" | "detail" | "hifi-list" | "hifi-detail" | null;

function cacheKind(pathname: string): CacheKind {
  if (pathname === "/stays" || pathname === "/blog") return "list";
  if (/^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname)) return "detail";
  if (pathname === "/hifi/stays") return "hifi-list";
  if (/^\/hifi\/stays\/[^/]+$/.test(pathname)) return "hifi-detail";
  return null;
}

function cacheHeader(profile: string | null, kind: CacheKind) {
  if (kind === "hifi-list") return CACHE_HIFI_LIST;
  if (kind === "hifi-detail") return CACHE_HIFI_DETAIL;
  if (profile === "idiomatic" || profile === "mobile-cold") {
    if (kind === "detail") return CACHE_DETAIL;
    if (kind === "list") return CACHE_LIST;
  }
  return "no-store";
}

export default {
  async fetch(request: Request, env: unknown, _ctx: unknown) {
    const start = performance.now();
    const url = new URL(request.url);
    if (url.pathname.startsWith("/__bench/")) {
      const benchResponse = handleContractApi("tanstack-start", request);
      if (benchResponse) return benchResponse;
    }
    const response = await app.fetch(request, env as never);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return response;
    }

    const headers = new Headers(response.headers);
    headers.set(
      "cache-control",
      cacheHeader(request.headers.get(BENCH_PROFILE_HEADER), cacheKind(url.pathname))
    );
    if (!headers.has("server-timing")) {
      headers.set("server-timing", `cf_bench;dur=${(performance.now() - start).toFixed(1)}`);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
