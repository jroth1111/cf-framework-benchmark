import { handleContractApi } from "@cf-bench/bench-contract";

type BenchEnv = Env & {
  ASSETS: Fetcher;
};

const BENCH_PROFILE_HEADER = "x-cf-bench-profile";
const CACHE_LIST = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const CACHE_DETAIL = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";
const CACHE_HIFI_LIST = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const CACHE_HIFI_DETAIL = "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";

type CacheKind = "list" | "detail" | "hifi-list" | "hifi-detail";

function normalizeBenchPath(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

function cacheKind(pathname: string): CacheKind | null {
  pathname = normalizeBenchPath(pathname);
  if (pathname === "/stays" || pathname === "/blog") return "list";
  if (pathname === "/hifi/stays") return "hifi-list";
  if (/^\/hifi\/stays\/[^/]+$/.test(pathname)) return "hifi-detail";
  if (/^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname)) return "detail";
  return null;
}

function cacheHeader(profile: string | null, kind: CacheKind | null) {
  if (profile === "idiomatic" || profile === "mobile-cold") {
    if (kind === "hifi-detail") return CACHE_HIFI_DETAIL;
    if (kind === "hifi-list") return CACHE_HIFI_LIST;
    if (kind === "detail") return CACHE_DETAIL;
    if (kind === "list") return CACHE_LIST;
  }
  return "no-store";
}

function assetRequestFor(request: Request, url: URL) {
  const headers = new Headers(request.headers);
  headers.delete("sec-fetch-mode");
  headers.delete("sec-fetch-dest");
  headers.delete("sec-fetch-site");
  headers.delete("sec-fetch-user");
  return new Request(url.toString(), {
    method: request.method,
    headers,
  });
}

function resolvePagePath(url: URL) {
  if (url.pathname.startsWith("/api/")) return null;
  if (url.pathname.includes(".")) return null;
  const base = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
  if (!base) return "/index.html";
  return `${base}/index.html`;
}

export default {
  async fetch(request: Request, env: BenchEnv): Promise<Response> {
    const api = handleContractApi("vike", request);
    if (api) return api;

    const start = performance.now();
    const url = new URL(request.url);
    const pagePath = resolvePagePath(url);
    const response = await env.ASSETS.fetch(
      assetRequestFor(request, pagePath ? new URL(pagePath, url) : url)
    );
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return response;

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
} satisfies ExportedHandler<Env>;
