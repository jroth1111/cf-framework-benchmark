import type { PageServerLoad } from "./$types";
import { BENCH_MEDIA_PAGE_SIZE, queryMedia } from "@cf-bench/dataset";

export const load: PageServerLoad = async () => ({
  items: queryMedia({ pageSize: BENCH_MEDIA_PAGE_SIZE }).results,
});
