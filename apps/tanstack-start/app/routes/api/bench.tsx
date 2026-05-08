import { createFileRoute } from "@tanstack/react-router";
import { handleContractApi } from "@cf-bench/bench-contract";
import { errorApiCacheHeader } from "@cf-bench/bench-cache";

export const Route = createFileRoute("/api/bench")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        handleContractApi("tanstack-start", request) ??
        new Response(JSON.stringify({ error: "not_found" }), {
          status: 404,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": errorApiCacheHeader("/api/bench"),
          },
        }),
    },
  },
});
