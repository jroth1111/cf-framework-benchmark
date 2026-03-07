import { createFileRoute } from "@tanstack/react-router";
import { queryMedia } from "@cf-bench/dataset";

export const Route = createFileRoute("/media")({
  loader: () => queryMedia({ pageSize: 30 }),
});
