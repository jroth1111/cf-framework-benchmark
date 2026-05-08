import app from "@tanstack/react-start/server-entry";
import { handleContractApi } from "@cf-bench/bench-contract";
import { htmlCacheHeaderForPath } from "@cf-bench/bench-cache";

const BENCH_PROFILE_HEADER = "x-cf-bench-profile";

export default {
  async fetch(request: Request, env: unknown, _ctx: unknown) {
    const start = performance.now();
    const url = new URL(request.url);
    if (url.pathname.startsWith("/__bench/")) {
      const benchResponse = handleContractApi("tanstack-start", request);
      if (benchResponse) return benchResponse;
    }
    const response = await app.fetch(request, env as never);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return response;
    }

    const headers = new Headers(response.headers);
    headers.set(
      "cache-control",
      htmlCacheHeaderForPath(url.pathname, request.headers.get(BENCH_PROFILE_HEADER))
    );
    if (!headers.has("server-timing")) {
      headers.set("server-timing", `cf_bench;dur=${(performance.now() - start).toFixed(1)}`);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
