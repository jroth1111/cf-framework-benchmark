import { handleBenchmarkRequest } from "@cf-bench/bench-contract";

export default defineEventHandler((event) => {
  const bench = handleBenchmarkRequest("nuxt", event.request);
  if (bench) return bench;
  return undefined;
});
