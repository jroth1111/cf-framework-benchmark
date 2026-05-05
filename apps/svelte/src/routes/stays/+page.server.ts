import type { PageServerLoad } from "./$types";
import { queryListings } from "@cf-bench/dataset";
import { benchCacheHeader } from "$lib/bench-cache";

export const load: PageServerLoad = async ({ request, setHeaders }) => {
  const cache = benchCacheHeader(request.headers.get("x-cf-bench-profile"), "list");
  if (cache) setHeaders({ "cache-control": cache });

  return { listings: queryListings({ page: 1, pageSize: 12 }).results };
};
