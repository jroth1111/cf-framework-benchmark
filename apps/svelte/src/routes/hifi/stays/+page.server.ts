import type { PageServerLoad } from "./$types";
import { queryListings } from "@cf-bench/dataset";

export const load: PageServerLoad = async ({ setHeaders }) => {
  setHeaders({ "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" });
  return { listings: queryListings({ page: 1, pageSize: 12 }).results };
};
