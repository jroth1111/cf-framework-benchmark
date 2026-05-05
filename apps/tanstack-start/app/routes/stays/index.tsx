import { createFileRoute } from "@tanstack/react-router";
import { queryListings } from "@cf-bench/dataset";

export const Route = createFileRoute("/stays/")({
  loader: () => queryListings({ page: 1, pageSize: 12 }).results,
});
