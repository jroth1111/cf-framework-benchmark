import type { PageServerLoad } from "./$types";
import { queryListings } from "@cf-bench/dataset";

export const load: PageServerLoad = async () => {
  return { listings: queryListings({ page: 1, pageSize: 12 }).results };
};
