import { defineMiddleware } from "astro:middleware";
import { applyBenchCache } from "./lib/bench-cache";

function benchmarkPageKind(pathname: string) {
  if (pathname === "/stays" || pathname === "/blog") return "list";
  if (/^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname)) return "detail";
  return null;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  if (context.url.pathname.startsWith("/api/")) return response;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  const headers = new Headers(response.headers);
  const kind = benchmarkPageKind(context.url.pathname);

  if (kind) {
    applyBenchCache(headers, context.request.headers.get("x-cf-bench-profile"), kind);
  } else {
    headers.set("cache-control", "no-store");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
