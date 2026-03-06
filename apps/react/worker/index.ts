import { handleContractApi } from "@cf-bench/bench-contract";
import { renderApp } from "../src/entry-server";

type Env = {
    ASSETS: Fetcher;
};

type BenchGlobal = typeof globalThis & {
    __CF_BENCH_REACT_SHELL__?: Promise<string>;
};

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

function isDocumentRequest(request: Request, url: URL) {
    if (request.method !== "GET") return false;
    if (url.pathname.startsWith("/api/")) return false;
    return !url.pathname.includes(".");
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

function withHtmlHeaders(pathname: string, profile: string | null, start: number, headers?: HeadersInit) {
    const next = new Headers(headers);
    next.set("content-type", "text/html; charset=utf-8");
    next.set("cache-control", cacheHeader(pathname, profile));
    if (!next.has("server-timing")) {
        next.set("server-timing", `cf_bench;dur=${(performance.now() - start).toFixed(1)}`);
    }
    return next;
}

function escapeAttr(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function renderBootstrap(url: URL) {
    const route = JSON.stringify({
        pathname: url.pathname,
        search: url.search,
        href: `${url.pathname}${url.search}`,
    });
    return `<script>
      (function () {
        var w = window;
        w.__CF_BENCH__ = w.__CF_BENCH__ || {};
        var hydration = (w.__CF_BENCH__.hydration = w.__CF_BENCH__.hydration || {});
        if (!Number.isFinite(hydration.startMs)) hydration.startMs = performance.now();
        w.__CF_BENCH_ROUTE__ = ${route};
      })();
    </script>`;
}

function injectDocument(shell: string, url: URL, appHtml: string) {
    const route = `${url.pathname}${url.search}`;
    const root = `<div id="root" data-framework="react" data-route="${escapeAttr(route)}">${appHtml}</div>`;
    return shell.replace('<div id="root"></div>', `${renderBootstrap(url)}\n    ${root}`);
}

async function loadShell(env: Env, request: Request, origin: URL) {
    const g = globalThis as BenchGlobal;
    if (!g.__CF_BENCH_REACT_SHELL__) {
        const assetUrl = new URL("/index.html", origin);
        g.__CF_BENCH_REACT_SHELL__ = env.ASSETS.fetch(assetRequestFor(assetUrl, request)).then(async (response) => {
            if (!response.ok) {
                g.__CF_BENCH_REACT_SHELL__ = undefined;
                throw new Error(`Failed to load React shell: ${response.status}`);
            }
            return response.text();
        });
    }
    return g.__CF_BENCH_REACT_SHELL__;
}

async function renderDocument(request: Request, env: Env, url: URL, start: number) {
    const shell = await loadShell(env, request, url);
    const html = injectDocument(shell, url, renderApp(`${url.pathname}${url.search}`));
    const headers = withHtmlHeaders(url.pathname, request.headers.get("x-cf-bench-profile"), start);
    return new Response(html, { status: 200, headers });
}

function assetRequest(request: Request, url: URL) {
    if (isDocumentRequest(request, url)) {
        return assetRequestFor(new URL("/index.html", url), request);
    }
    return assetRequestFor(url, request);
}

function withDocumentFallback(response: Response, pathname: string, profile: string | null, start: number) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return response;
    const headers = new Headers(response.headers);
    headers.set("cache-control", cacheHeader(pathname, profile));
    if (!headers.has("server-timing")) {
        headers.set("server-timing", `cf_bench;dur=${(performance.now() - start).toFixed(1)}`);
    }
    return new Response(response.body, { ...response, headers });
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const api = handleContractApi("react", request);
        if (api) return api;

        const start = performance.now();
        if (isDocumentRequest(request, url)) {
            try {
                return await renderDocument(request, env, url, start);
            } catch (error) {
                console.error(error);
            }
        }

        const res = await env.ASSETS.fetch(assetRequest(request, url));
        return withDocumentFallback(res, url.pathname, request.headers.get("x-cf-bench-profile"), start);
    },
};
