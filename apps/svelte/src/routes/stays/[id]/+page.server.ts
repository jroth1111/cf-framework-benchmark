import type { PageServerLoad } from "./$types";
import { getListing } from "@cf-bench/dataset";

export const load: PageServerLoad = async ({ params }) => {
  const listing = getListing(params.id);
  return { listing };
};
