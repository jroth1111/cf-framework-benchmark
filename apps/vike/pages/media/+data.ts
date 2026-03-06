import { queryMedia } from "../../src/bench";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data() {
  return {
    items: queryMedia({ pageSize: 30 }).results,
  };
}
