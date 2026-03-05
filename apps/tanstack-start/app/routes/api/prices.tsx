import { createFileRoute } from "@tanstack/react-router";
import { handleContractApi } from "@cf-bench/bench-contract";

export const Route = createFileRoute("/api/prices")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        handleContractApi("tanstack-start", request) ??
        new Response(JSON.stringify({ error: "not_found" }), {
          status: 404,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        }),
    },
  },
});
