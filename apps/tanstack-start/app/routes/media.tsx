import { createFileRoute } from "@tanstack/react-router";
import { BENCH_MEDIA_PAGE_SIZE, queryMedia } from "@cf-bench/dataset";

export const Route = createFileRoute("/media")({
  loader: () => queryMedia({ pageSize: BENCH_MEDIA_PAGE_SIZE }),
});
