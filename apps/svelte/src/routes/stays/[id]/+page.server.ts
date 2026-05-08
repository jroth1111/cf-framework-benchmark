import type { PageServerLoad } from "./$types";
import { getListing } from "@cf-bench/dataset";
import { htmlCacheHeader } from "@cf-bench/bench-cache";

export const load: PageServerLoad = async ({ params, request, setHeaders }) => {
  setHeaders({
    "cache-control": htmlCacheHeader("/stays/:id", request.headers.get("x-cf-bench-profile")),
  });

  const listing = getListing(params.id);
  return { listing };
};
