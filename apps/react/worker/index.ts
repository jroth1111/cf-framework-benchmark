import { handleBenchmarkRequest } from "@cf-bench/bench-contract";

type Env = {
    ASSETS: Fetcher;
};

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
        const bench = handleBenchmarkRequest("react", request);
        if (bench) return bench;

        // For SPA: all non-API routes should serve index.html (handled by wrangler assets SPA fallback)
        const res = await env.ASSETS.fetch(request);
        return applyHtmlCache(res);
    },
};
