import { handleBenchmarkRequest } from "@cf-bench/bench-contract";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const bench = handleBenchmarkRequest("redwood", request);
    if (bench) return bench;

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
