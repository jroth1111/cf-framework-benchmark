import { handleContractApi } from "@cf-bench/bench-contract";
import { createMiddleware } from "@solidjs/start/middleware";

function cacheKind(pathname: string) {
  if (pathname === "/stays" || pathname === "/blog") return "list";
  if (/^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname)) return "detail";
  return null;
}

function cacheHeader(pathname: string, profile: string | null) {
  const kind = cacheKind(pathname);
  if (profile === "idiomatic" || profile === "mobile-cold") {
    if (kind === "detail") return "public, max-age=0, s-maxage=300, stale-while-revalidate=600";
    if (kind === "list") return "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
  }
  return "no-store";
}

export default createMiddleware({
  onRequest: (event) => {
    (event.locals as { benchStart?: number }).benchStart = performance.now();
    return handleContractApi("solidstart", event.request);
  },
  onBeforeResponse: (event) => {
    const response = event.response;
    if (!response) return;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return;

    const headers = new Headers(response.headers);
    const url = new URL(event.request.url);
    headers.set("cache-control", cacheHeader(url.pathname, event.request.headers.get("x-cf-bench-profile")));

    if (!headers.has("server-timing")) {
      const start = (event.locals as { benchStart?: number }).benchStart ?? performance.now();
      headers.set("server-timing", `cf_bench;dur=${(performance.now() - start).toFixed(1)}`);
    }

    event.response = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
});
