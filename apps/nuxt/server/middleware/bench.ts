import { handleBenchmarkRequest } from "@cf-bench/bench-contract";

export default defineEventHandler((event) => {
  const method = event.node.req.method || "GET";
  const proto = event.node.req.headers["x-forwarded-proto"] || "https";
  const host = event.node.req.headers.host || "cf-bench.local";
  const path = event.node.req.url || "/";
  const request = new Request(`${proto}://${host}${path}`, { method });
  const bench = handleBenchmarkRequest("nuxt", request);
  if (bench) return bench;
  return undefined;
});
