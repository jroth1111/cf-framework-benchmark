import worker from "./.open-next/worker.js";

const BENCH_PROFILE_HEADER = "x-cf-bench-profile";
const CACHE_LIST = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const CACHE_DETAIL = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";

function cacheKind(pathname) {
  if (pathname === "/stays" || pathname === "/blog") return "list";
  if (/^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname)) return "detail";
  return null;
}

function cacheHeader(profile, kind) {
  if (profile === "idiomatic" || profile === "mobile-cold") {
    if (kind === "detail") return CACHE_DETAIL;
    if (kind === "list") return CACHE_LIST;
  }
  return "no-store";
}

function applyHtmlHeaders(response, request, start) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const headers = new Headers(response.headers);
  const pathname = new URL(request.url).pathname;
  headers.set("cache-control", cacheHeader(request.headers.get(BENCH_PROFILE_HEADER), cacheKind(pathname)));
  headers.set("server-timing", `cf_bench;dur=${(performance.now() - start).toFixed(1)}`);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    const start = performance.now();
    const response = await worker.fetch(request, env, ctx);
    return applyHtmlHeaders(response, request, start);
  },
};
