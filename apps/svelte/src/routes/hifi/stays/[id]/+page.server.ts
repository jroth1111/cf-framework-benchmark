import type { PageServerLoad } from "./$types";
import { getListing } from "@cf-bench/dataset";
import { htmlCacheHeader } from "@cf-bench/bench-cache";

export const load: PageServerLoad = async ({ params, request, setHeaders }) => {
  setHeaders({
    "cache-control": htmlCacheHeader("/hifi/stays/:id", request.headers.get("x-cf-bench-profile")),
  });
  return { listing: getListing(params.id) };
};
