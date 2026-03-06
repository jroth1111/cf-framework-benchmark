import { handleContractApi } from "@cf-bench/bench-contract";

type Env = {
    ASSETS: Fetcher;
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

function applyHtmlHeaders(response: Response, pathname: string, profile: string | null, start: number) {
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
        const pagePath = resolvePagePath(url);
        if (pagePath) {
            const next = new URL(pagePath, url);
            const res = await env.ASSETS.fetch(assetRequestFor(next, request));
            return applyHtmlHeaders(res, url.pathname, request.headers.get("x-cf-bench-profile"), start);
        }
        const res = await env.ASSETS.fetch(assetRequestFor(url, request));
        return applyHtmlHeaders(res, url.pathname, request.headers.get("x-cf-bench-profile"), start);
    },
};
