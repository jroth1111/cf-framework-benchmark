import { createQwikCity } from "@qwik.dev/router/middleware/cloudflare-pages";
import { htmlCacheHeaderForPath } from "@cf-bench/bench-cache";
import render from "./entry.ssr";

const baseFetch = createQwikCity({ render });

const BENCH_PROFILE_HEADER = "x-cf-bench-profile";

const fetch: typeof baseFetch = async (request, env, ctx) => {
  const start = performance.now();
  const response = await baseFetch(request, env, ctx);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const url = new URL(request.url);
  const cacheHeader = htmlCacheHeaderForPath(url.pathname, request.headers.get(BENCH_PROFILE_HEADER));

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
