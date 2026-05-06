import { handleContractApi } from "@cf-bench/bench-contract";
import { getHifiHeadHtml } from "@cf-bench/hifi-shell";
import { renderApp } from "../src/entry-server";

type Env = {
    ASSETS: Fetcher;
};

type BenchGlobal = typeof globalThis & {
    __CF_BENCH_REACT_SHELL__?: Promise<string>;
};

function normalizeBenchPath(pathname: string) {
    return pathname.replace(/\/+$/, "") || "/";
}

function cacheKind(pathname: string) {
    pathname = normalizeBenchPath(pathname);
    if (pathname === "/hifi/stays") return "hifi-list";
    if (/^\/hifi\/stays\/[^/]+$/.test(pathname)) return "hifi-detail";
    if (pathname === "/stays" || pathname === "/blog") return "list";
    if (/^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname)) return "detail";
    return null;
}

function cacheHeader(pathname: string, profile: string | null) {
    const kind = cacheKind(pathname);
    if (kind === "hifi-detail") return "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";
    if (kind === "hifi-list") return "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
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

function isBenchmarkRoute(pathname: string) {
    pathname = normalizeBenchPath(pathname);
    if (pathname === "/" || pathname === "/stays" || pathname === "/blog" || pathname === "/chart" || pathname === "/media") {
        return true;
    }
    if (pathname === "/hifi/stays") return true;
    if (/^\/hifi\/stays\/[^/]+$/.test(pathname)) return true;
    return /^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname);
}

function isHifiRoute(pathname: string) {
    pathname = normalizeBenchPath(pathname);
    return pathname === "/hifi/stays" || /^\/hifi\/stays\/[^/]+$/.test(pathname);
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
    const pathname = normalizeBenchPath(url.pathname);
    const route = JSON.stringify({
        pathname,
        search: url.search,
        href: `${pathname}${url.search}`,
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

function stripClientAssets(shell: string) {
    const withoutClientRegion = shell.replace(/__CF_BENCH_CLIENT_ASSETS_START__[\s\S]*?__CF_BENCH_CLIENT_ASSETS_END__/, "");
    return withoutClientRegion
        .replaceAll("__CF_BENCH_CLIENT_ASSETS_START__", "")
        .replaceAll("__CF_BENCH_CLIENT_ASSETS_END__", "")
        .replace(/\s*<link rel="modulepreload"[^>]*>/g, "")
        .replace(/\s*<script type="module"[^>]*src="[^"]+"[^>]*><\/script>\s*/g, "");
}

function injectHifiHead(shell: string) {
    const headHtml = getHifiHeadHtml();
    const headOpen = shell.indexOf("</head>");
    if (headOpen === -1) return shell;
    return shell.slice(0, headOpen) + headHtml + shell.slice(headOpen);
}

function injectDocument(shell: string, url: URL, appHtml: string) {
    if (!shell.includes('<div id="root"></div>')) {
        throw new Error("React shell missing root placeholder");
    }
    const pathname = normalizeBenchPath(url.pathname);
    const route = `${pathname}${url.search}`;
    const includeClient = needsClient(pathname);
    const root = `<div id="root" data-framework="react" data-route="${escapeAttr(route)}">${appHtml}</div>`;
    const hydrationTail = includeClient
        ? ""
        : '<script>(function(){var w=globalThis;w.__CF_BENCH__=w.__CF_BENCH__||{};var h=(w.__CF_BENCH__.hydration=w.__CF_BENCH__.hydration||{});if(h.endMs==null)h.endMs=h.startMs??performance.now();})();</script>';
    let documentShell = includeClient ? shell : stripClientAssets(shell);
    if (isHifiRoute(pathname)) {
        documentShell = injectHifiHead(documentShell);
    }
    return documentShell.replace('<div id="root"></div>', `${renderBootstrap(url)}\n    ${root}${hydrationTail}`);
}

async function loadShell(env: Env, request: Request, origin: URL) {
    const g = globalThis as BenchGlobal;
    if (!g.__CF_BENCH_REACT_SHELL__) {
        const assetUrl = new URL("/index.html", origin);
        g.__CF_BENCH_REACT_SHELL__ = env.ASSETS.fetch(assetRequestFor(assetUrl, request))
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load React shell: ${response.status}`);
                }
                const shell = await response.text();
                if (!shell.includes('<div id="root"></div>')) {
                    throw new Error("Failed to load React shell: missing root placeholder");
                }
                return shell;
            })
            .catch((error) => {
                g.__CF_BENCH_REACT_SHELL__ = undefined;
                throw error;
            });
    }
    return g.__CF_BENCH_REACT_SHELL__;
}

async function renderDocument(request: Request, env: Env, url: URL, start: number) {
    const pathname = normalizeBenchPath(url.pathname);
    if (!isBenchmarkRoute(pathname)) {
        return new Response("Not found", {
            status: 404,
            headers: {
                "content-type": "text/plain; charset=utf-8",
                "cache-control": "no-store",
                "server-timing": `cf_bench;dur=${(performance.now() - start).toFixed(1)}`,
            },
        });
    }
    const shell = await loadShell(env, request, url);
    const html = injectDocument(shell, url, renderApp(`${pathname}${url.search}`));
    const headers = withHtmlHeaders(pathname, request.headers.get("x-cf-bench-profile"), start);
    return new Response(html, { status: 200, headers });
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
                return new Response("React document render failed", {
                    status: 500,
                    headers: {
                        "content-type": "text/plain; charset=utf-8",
                        "cache-control": "no-store",
                    },
                });
            }
        }

        const res = await env.ASSETS.fetch(assetRequestFor(url, request));
        return withDocumentFallback(res, normalizeBenchPath(url.pathname), request.headers.get("x-cf-bench-profile"), start);
    },
};
