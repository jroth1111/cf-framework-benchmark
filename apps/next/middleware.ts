import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const BENCH_PROFILE_HEADER = "x-cf-bench-profile";
const CACHE_LIST = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const CACHE_DETAIL = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";

function cacheKind(pathname: string) {
  if (pathname === "/stays" || pathname === "/blog") return "list";
  if (/^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname)) return "detail";
  return null;
}

function cacheHeader(profile: string | null, kind: "list" | "detail" | null) {
  if (profile === "idiomatic" || profile === "mobile-cold") {
    if (kind === "detail") return CACHE_DETAIL;
    if (kind === "list") return CACHE_LIST;
  }
  return "no-store";
}

export function middleware(request: NextRequest) {
  const start = performance.now();
  const response = NextResponse.next();
  const kind = cacheKind(request.nextUrl.pathname);

  response.headers.set(
    "cache-control",
    cacheHeader(request.headers.get(BENCH_PROFILE_HEADER), kind)
  );
  response.headers.set("server-timing", `cf_bench;dur=${(performance.now() - start).toFixed(1)}`);
  return response;
}

export const config = {
  matcher: ["/", "/chart", "/media", "/stays", "/stays/:path*", "/blog", "/blog/:path*"],
};
