import type { PageServerLoad } from "./$types";
import { getListing } from "@cf-bench/dataset";

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  setHeaders({ "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400" });
  return { listing: getListing(params.id) };
};
