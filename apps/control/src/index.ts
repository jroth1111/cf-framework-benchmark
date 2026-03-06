import { handleControlRequest } from "@cf-bench/bench-control";
import { handleContractApi } from "@cf-bench/bench-contract";

export default {
  async fetch(request: Request): Promise<Response> {
    const api = handleContractApi("control", request);
    if (api) return api;

    const page = handleControlRequest("control", request);
    if (page) return page;

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler;
