import { createRequestHandler } from "react-router";
import { handleContractApi } from "@cf-bench/bench-contract";
import { htmlCacheHeaderForPath } from "@cf-bench/bench-cache";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

const BENCH_PROFILE_HEADER = "x-cf-bench-profile";

export default {
  async fetch(request, env, ctx) {
    const api = handleContractApi("react-router", request);
    if (api) return api;

    const start = performance.now();
    const response = await requestHandler(request, {
      cloudflare: { env, ctx },
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return response;
    }

    const url = new URL(request.url);
    const headers = new Headers(response.headers);
    headers.set("cache-control", htmlCacheHeaderForPath(url.pathname, request.headers.get(BENCH_PROFILE_HEADER)));
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
