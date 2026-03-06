import type { PageServerLoad } from "./$types";
import { queryMedia } from "@cf-bench/dataset";

export const load: PageServerLoad = async () => ({
  items: queryMedia({ pageSize: 30 }).results,
});
