import { BENCH_MEDIA_PAGE_SIZE, queryMedia } from "../../src/bench";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data() {
  return {
    items: queryMedia({ pageSize: BENCH_MEDIA_PAGE_SIZE }).results,
  };
}
