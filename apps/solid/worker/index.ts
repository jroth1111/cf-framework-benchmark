import { handleContractApi } from "@cf-bench/bench-contract";
import { renderRoute } from "./render";

type Env = {
  ASSETS: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
};

type ManifestEntry = {
  file: string;
  css?: string[];
};

let clientManifestPromise: Promise<ManifestEntry> | null = null;

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

function applyHtmlHeaders(headersInit: HeadersInit | null, pathname: string, profile: string | null, start: number) {
  const headers = new Headers(headersInit ?? undefined);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", cacheHeader(pathname, profile));
  if (!headers.has("server-timing")) {
    headers.set("server-timing", `cf_bench;dur=${(performance.now() - start).toFixed(1)}`);
  }
  return headers;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJson(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

async function readAssetText(env: Env, pathname: string, request: Request) {
  const url = new URL(pathname, request.url);
  const response = await env.ASSETS.fetch(assetRequestFor(url, request));
  if (!response.ok) {
    throw new Error(`Missing asset ${pathname}: ${response.status}`);
  }
  return response.text();
}

async function getClientManifest(env: Env, request: Request) {
  clientManifestPromise ??= (async () => {
    const manifestText = await readAssetText(env, "/manifest.json", request);
    const manifest = JSON.parse(manifestText) as Record<string, ManifestEntry>;
    const entry = manifest["src/client.ts"];
    if (!entry) {
      throw new Error("Missing src/client.ts in Vite manifest");
    }
    return entry;
  })();
  return clientManifestPromise;
}

async function renderDocument(pathname: string, env: Env, request: Request) {
  const route = renderRoute(pathname);
  if (!route) return null;

  const clientEntry = await getClientManifest(env, request);
  const styleLinks = (clientEntry.css ?? [])
    .map((href) => `    <link rel="stylesheet" href="/${href}" />`)
    .join("\n");
  const pagePropsScript = route.pageProps
    ? `\n    <script>window.__PAGE_PROPS__=${safeJson(route.pageProps)};</script>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(route.title)}</title>
${styleLinks}
    <script>
      (function () {
        var w = window;
        w.__CF_BENCH__ = w.__CF_BENCH__ || {};
        var h = (w.__CF_BENCH__.hydration = w.__CF_BENCH__.hydration || {});
        if (h.startMs == null) h.startMs = performance.now();
      })();
    </script>
  </head>
  <body data-route="${route.route}">
    <div id="app">${route.html}</div>${pagePropsScript}
    <script type="module" src="/${clientEntry.file}"></script>
  </body>
</html>`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const api = handleContractApi("solid", request);
    if (api) return api;

    const start = performance.now();
    if (!url.pathname.includes(".")) {
      const html = await renderDocument(url.pathname, env, request);
      if (html) {
        return new Response(html, {
          status: 200,
          headers: applyHtmlHeaders(null, url.pathname, request.headers.get("x-cf-bench-profile"), start),
        });
      }
    }

    const res = await env.ASSETS.fetch(assetRequestFor(url, request));
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return res;

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: applyHtmlHeaders(res.headers, url.pathname, request.headers.get("x-cf-bench-profile"), start),
    });
  },
};
