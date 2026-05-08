import { handleContractApi } from "@cf-bench/bench-contract";
import { htmlCacheHeaderForPath } from "@cf-bench/bench-cache";

type BenchEnv = Env & {
  ASSETS: Fetcher;
};

const BENCH_PROFILE_HEADER = "x-cf-bench-profile";

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
      htmlCacheHeaderForPath(url.pathname, request.headers.get(BENCH_PROFILE_HEADER))
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
