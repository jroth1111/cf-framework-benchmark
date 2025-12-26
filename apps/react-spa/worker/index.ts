import { chartSymbols, generateCandles, getListing, queryListings } from "@cf-bench/dataset";

type Env = {
    ASSETS: Fetcher;
};

function getIsolateId() {
    const globalAny = globalThis as any;
    if (!globalAny.__CF_BENCH_ISOLATE_ID) {
        globalAny.__CF_BENCH_ISOLATE_ID = crypto.randomUUID();
    }
    return globalAny.__CF_BENCH_ISOLATE_ID as string;
}

function json(data: unknown, init?: ResponseInit, timingStart?: number) {
    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json; charset=utf-8");
    if (!headers.has("cache-control")) headers.set("cache-control", "public, max-age=0, s-maxage=60");
    if (!headers.has("server-timing")) {
        const dur = typeof timingStart === "number" ? performance.now() - timingStart : null;
        headers.set(
            "server-timing",
            dur == null
                ? `cf_bench;desc=\"${getIsolateId()}\"`
                : `cf_bench;dur=${dur.toFixed(1)};desc=\"${getIsolateId()}\"`
        );
    }
    return new Response(JSON.stringify(data), { ...init, headers });
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
        const start = performance.now();

        if (url.pathname === "/api/bench") {
            (globalThis as any).__CF_BENCH_ISOLATE_HITS = ((globalThis as any).__CF_BENCH_ISOLATE_HITS ?? 0) + 1;
            return json(
                { isolateId: getIsolateId(), hits: (globalThis as any).__CF_BENCH_ISOLATE_HITS, now: Date.now() },
                { headers: { "cache-control": "no-store" } },
                start
            );
        }

        if (url.pathname === "/api/health") {
            return json({ ok: true, ts: Date.now() }, { headers: { "cache-control": "no-store" } }, start);
        }

        if (url.pathname === "/api/listings") {
            const city = url.searchParams.get("city") || "";
            const max = url.searchParams.get("max");
            const sort = (url.searchParams.get("sort") || "relevance") as any;
            const page = Number(url.searchParams.get("page") || "1");
            const pageSize = Number(url.searchParams.get("pageSize") || "24");
            const maxNum = max ? Number(max) : undefined;
            return json(
                queryListings({
                    city,
                    max: Number.isFinite(maxNum) ? maxNum : undefined,
                    sort,
                    page: Number.isFinite(page) ? page : 1,
                    pageSize: Number.isFinite(pageSize) ? pageSize : 24,
                }),
                undefined,
                start
            );
        }

        const listingMatch = url.pathname.match(/^\/api\/listings\/(\d{3})$/);
        if (listingMatch) {
            const id = listingMatch[1];
            const l = getListing(id);
                if (!l) return json({ error: "not_found" }, { status: 404, headers: { "cache-control": "no-store" } }, start);
            return json(
                { listing: l },
                { headers: { "cache-control": "public, max-age=0, s-maxage=300" } },
                start
            );
        }

        if (url.pathname === "/api/prices") {
            const symbol = (url.searchParams.get("symbol") || "BTC").toUpperCase();
            const timeframe = url.searchParams.get("timeframe") || "1h";
            const points = Number(url.searchParams.get("points") || "360");
        if (!chartSymbols.includes(symbol)) {
            return json({ error: "unknown_symbol" }, { status: 400, headers: { "cache-control": "no-store" } }, start);
        }
            const candles = generateCandles(symbol, {
                timeframe,
                points: Number.isFinite(points) ? Math.max(60, Math.min(2000, points)) : 360,
            });
            return json(
                { symbol, timeframe, candles },
                { headers: { "cache-control": "public, max-age=0, s-maxage=60" } },
                start
            );
        }

        // For SPA: all non-API routes should serve index.html (handled by wrangler assets SPA fallback)
        const res = await env.ASSETS.fetch(request);
        return applyHtmlCache(res);
    },
};
