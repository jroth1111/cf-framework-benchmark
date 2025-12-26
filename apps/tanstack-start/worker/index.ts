import server from "@tanstack/react-start/server-entry";

const BENCH_PROFILE_HEADER = "x-cf-bench-profile";
const CACHE_LIST = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const CACHE_DETAIL = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";

function cacheKindForPath(pathname: string) {
  if (pathname === "/stays" || pathname === "/blog") return "list";
  if (pathname.startsWith("/stays/") || pathname.startsWith("/blog/")) return "detail";
  return null;
}

function cacheHeaderFor(profile: string | null, kind: "list" | "detail" | null) {
  if (!kind) return null;
  if (profile === "idiomatic" || profile === "mobile-cold") {
    return kind === "detail" ? CACHE_DETAIL : CACHE_LIST;
  }
  if (profile === "parity") return "no-store";
  return null;
}

export default {
  async fetch(request: Request, env: unknown, ctx: any) {
    const response = await server.fetch(request, env, ctx);
    const url = new URL(request.url);
    const kind = cacheKindForPath(url.pathname);
    if (!kind) return response;

    const profile = request.headers.get(BENCH_PROFILE_HEADER);
    const cacheHeader = cacheHeaderFor(profile, kind);
    if (!cacheHeader) return response;

    const headers = new Headers(response.headers);
    headers.set("cache-control", cacheHeader);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
