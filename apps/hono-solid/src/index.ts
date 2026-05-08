import { Hono } from "hono";
import { handleContractApi } from "@cf-bench/bench-contract";
import { htmlCacheHeaderForPath } from "@cf-bench/bench-cache";
import { renderRoute } from "./render";

type Bindings = Env & {
  ASSETS?: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
};

type ManifestEntry = {
  file: string;
  css?: string[];
};

let clientManifestPromise: Promise<ManifestEntry> | null = null;

function normalizeBenchPath(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

function needsClient(pathname: string) {
  pathname = normalizeBenchPath(pathname);
  return pathname === "/chart" || pathname === "/media";
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
  headers.set("cache-control", htmlCacheHeaderForPath(pathname, profile));
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

async function readAssetText(env: Bindings, pathname: string, request: Request) {
  if (!env.ASSETS) {
    throw new Error("Missing ASSETS binding");
  }

  const url = new URL(pathname, request.url);
  const response = await env.ASSETS.fetch(assetRequestFor(url, request));
  if (!response.ok) {
    throw new Error(`Missing asset ${pathname}: ${response.status}`);
  }
  return response.text();
}

async function getClientManifest(env: Bindings, request: Request) {
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

async function renderDocument(pathname: string, env: Bindings, request: Request) {
  pathname = normalizeBenchPath(pathname);
  const route = renderRoute(pathname);
  if (!route) return null;

  const clientEntry = await getClientManifest(env, request);
  const styleLinks = (clientEntry.css ?? [])
    .map((href) => `    <link rel="stylesheet" href="/${href}" />`)
    .join("\n");
  const includeClient = needsClient(pathname);
  const pagePropsScript = route.pageProps
    ? `\n    <script>window.__PAGE_PROPS__=${safeJson(route.pageProps)};</script>`
    : "";
  const clientScript = includeClient
    ? `\n    <script type="module" src="/${clientEntry.file}"></script>`
    : `\n    <script>(function(){var w=window;w.__CF_BENCH__=w.__CF_BENCH__||{};var h=(w.__CF_BENCH__.hydration=w.__CF_BENCH__.hydration||{});if(h.endMs==null)h.endMs=h.startMs??performance.now();})();</script>`;
  const headExtras = route.headExtras ? `\n    ${route.headExtras}` : "";
  const tailExtras = route.tailExtras ?? "";

  const html = `<!doctype html>
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
    </script>${headExtras}
  </head>
  <body data-route="${route.route}">
    <div id="app">${route.html}</div>${tailExtras}${pagePropsScript}${clientScript}
  </body>
</html>`;
  return { html, status: route.status ?? 200 };
}

const app = new Hono<{ Bindings: Bindings }>();

app.all("*", async (c) => {
  const api = handleContractApi("hono-solid", c.req.raw);
  if (api) return api;

  const url = new URL(c.req.raw.url);
  const start = performance.now();
  if (!url.pathname.includes(".")) {
    const document = await renderDocument(url.pathname, c.env, c.req.raw);
    if (document) {
        return new Response(document.html, {
          status: document.status,
        headers: applyHtmlHeaders(null, normalizeBenchPath(url.pathname), c.req.header("x-cf-bench-profile") ?? null, start),
      });
    }
  }

  if (!c.env.ASSETS) {
    return c.text("Not found", 404);
  }

  const response = await c.env.ASSETS.fetch(assetRequestFor(url, c.req.raw));
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: applyHtmlHeaders(response.headers, url.pathname, c.req.header("x-cf-bench-profile") ?? null, start),
  });
});

export default app;
