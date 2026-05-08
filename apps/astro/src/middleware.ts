import { defineMiddleware } from "astro:middleware";
import { htmlCacheHeaderForPath } from "@cf-bench/bench-cache";

export const onRequest = defineMiddleware(async (context, next) => {
  const start = performance.now();
  const response = await next();
  if (context.url.pathname.startsWith("/api/")) return response;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set(
    "cache-control",
    htmlCacheHeaderForPath(
      context.url.pathname,
      context.request.headers.get("x-cf-bench-profile")
    )
  );
  if (!headers.has("server-timing")) {
    headers.set("server-timing", `cf_bench;dur=${(performance.now() - start).toFixed(1)}`);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
