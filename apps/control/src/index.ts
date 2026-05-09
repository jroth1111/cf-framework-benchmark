import { NO_STORE } from "@cf-bench/bench-cache";
import { handleControlRequest } from "@cf-bench/bench-control";
import { handleContractApi } from "@cf-bench/bench-contract";

export default {
  async fetch(request: Request): Promise<Response> {
    const start = performance.now();
    const api = handleContractApi("control", request);
    if (api) return api;

    const page = handleControlRequest("control", request, start);
    if (page) return page;

    return new Response("Not found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": NO_STORE,
        "server-timing": `cf_bench;dur=${(performance.now() - start).toFixed(1)}`,
      },
    });
  },
} satisfies ExportedHandler;
