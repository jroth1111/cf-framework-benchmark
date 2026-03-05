import { handleBenchmarkRequest } from "@cf-bench/bench-contract";

type Env = {
  ASSETS: Fetcher;
};

function resolvePagePath(url: URL) {
  if (url.pathname.startsWith("/api/")) return null;
  if (url.pathname.includes(".")) return null;
  const base = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
  if (!base) return "/pages/index.html";
  return `/pages${base}/index.html`;
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

function applyHtmlCache(response: Response) {
  if (response.headers.has("cache-control")) return response;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  return new Response(response.body, { ...response, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const bench = handleBenchmarkRequest("solid", request);
    if (bench) return bench;

    const pagePath = resolvePagePath(url);
    if (pagePath) {
      const next = new URL(pagePath, url);
      const res = await env.ASSETS.fetch(assetRequestFor(next, request));
      return applyHtmlCache(res);
    }
    const res = await env.ASSETS.fetch(assetRequestFor(url, request));
    return applyHtmlCache(res);
  },
};
