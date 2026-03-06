import { createQwikCity } from "@qwik.dev/router/middleware/cloudflare-pages";
import render from "./entry.ssr";

const baseFetch = createQwikCity({ render });

const BENCH_PROFILE_HEADER = "x-cf-bench-profile";
const CACHE_LIST = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const CACHE_DETAIL = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";

function cacheKindForPath(pathname: string) {
  if (pathname === "/stays" || pathname === "/blog") return "list";
  if (pathname.startsWith("/stays/") || pathname.startsWith("/blog/")) return "detail";
  return null;
}

function cacheHeaderFor(profile: string | null, kind: "list" | "detail" | null) {
  if (profile === "idiomatic" || profile === "mobile-cold") {
    if (kind === "detail") return CACHE_DETAIL;
    if (kind === "list") return CACHE_LIST;
  }
  return "no-store";
}

const fetch: typeof baseFetch = async (request, env, ctx) => {
  const start = performance.now();
  const response = await baseFetch(request, env, ctx);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const url = new URL(request.url);
  const kind = cacheKindForPath(url.pathname);
  const cacheHeader = cacheHeaderFor(request.headers.get(BENCH_PROFILE_HEADER), kind);

  const headers = new Headers(response.headers);
  headers.set("cache-control", cacheHeader);
  if (!headers.has("server-timing")) {
    headers.set("server-timing", `cf_bench;dur=${(performance.now() - start).toFixed(1)}`);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export { fetch };
export default { fetch };
