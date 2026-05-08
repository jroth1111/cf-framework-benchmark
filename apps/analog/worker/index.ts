import { handleContractApi } from "@cf-bench/bench-contract";
import { htmlCacheHeaderForPath } from "@cf-bench/bench-cache";
import app from "../dist/analog/server/index.mjs";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const api = handleContractApi("analog", request);
    if (api) return api;

    const start = performance.now();
    const response = await app.fetch(request, env, ctx);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return response;
    }

    const url = new URL(request.url);
    const profile = request.headers.get("x-cf-bench-profile");
    const headers = new Headers(response.headers);
    headers.set("cache-control", htmlCacheHeaderForPath(url.pathname, profile));
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
