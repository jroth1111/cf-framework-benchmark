import type { Handle } from "@sveltejs/kit";
import { handleBenchmarkRequest } from "@cf-bench/bench-contract";

export const handle: Handle = async ({ event, resolve }) => {
  const bench = handleBenchmarkRequest("svelte", event.request);
  if (bench) return bench;

  const response = await resolve(event);
  if (!event.url.pathname.startsWith("/api/")) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      response.headers.set("cache-control", "no-store");
    }
  }
  return response;
};
