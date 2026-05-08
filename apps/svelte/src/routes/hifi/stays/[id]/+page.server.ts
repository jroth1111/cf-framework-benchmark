import type { PageServerLoad } from "./$types";
import { getListing } from "@cf-bench/dataset";

export const load: PageServerLoad = async ({ params }) => {
  return { listing: getListing(params.id) };
};
