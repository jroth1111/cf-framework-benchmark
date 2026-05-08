import worker from "./.output/server/index.mjs";
import { htmlCacheHeaderForPath } from "@cf-bench/bench-cache";

function applyHtmlHeaders(response, start, pathname, profile) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const headers = new Headers(response.headers);
  headers.set("cache-control", htmlCacheHeaderForPath(pathname, profile));
  const duration = Math.max(0.1, performance.now() - start);
  if (!headers.has("server-timing")) {
    headers.set("server-timing", `cf_bench;dur=${duration.toFixed(1)}`);
  }
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
    const { pathname } = new URL(request.url);
    const profile = request.headers.get("x-cf-bench-profile");
    return applyHtmlHeaders(response, start, pathname, profile);
  },
};
