import type { PageServerLoad } from "./$types";
import { queryListings } from "@cf-bench/dataset";
import { htmlCacheHeader } from "@cf-bench/bench-cache";

export const load: PageServerLoad = async ({ request, setHeaders }) => {
  setHeaders({
    "cache-control": htmlCacheHeader("/stays", request.headers.get("x-cf-bench-profile")),
  });

  return { listings: queryListings({ page: 1, pageSize: 12 }).results };
};
