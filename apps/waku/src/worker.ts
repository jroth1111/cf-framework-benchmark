import { handleContractApi } from "@cf-bench/bench-contract";
import { htmlCacheHeaderForPath } from "@cf-bench/bench-cache";

type BenchEnv = Env & {
  ASSETS: Fetcher;
};

function resolvePagePath(url: URL) {
  if (url.pathname.startsWith("/api/")) return null;
  if (url.pathname.includes(".")) return null;
  const base = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
  if (!base) return "/index.html";
  return `${base}/index.html`;
}

function assetRequestFor(url: URL, request: Request) {
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

function applyHtmlHeaders(response: Response, pathname: string, profile: string | null, start: number) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  const headers = new Headers(response.headers);
  headers.set("cache-control", htmlCacheHeaderForPath(pathname, profile));
  if (!headers.has("server-timing")) {
    headers.set("server-timing", `cf_bench;dur=${(performance.now() - start).toFixed(1)}`);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: BenchEnv): Promise<Response> {
    const api = handleContractApi("waku", request);
    if (api) return api;

    const url = new URL(request.url);
    const start = performance.now();
    const pagePath = resolvePagePath(url);
    const response = await env.ASSETS.fetch(
      assetRequestFor(pagePath ? new URL(pagePath, url) : url, request)
    );
    return applyHtmlHeaders(response, url.pathname, request.headers.get("x-cf-bench-profile"), start);
  },
} satisfies ExportedHandler<Env>;
