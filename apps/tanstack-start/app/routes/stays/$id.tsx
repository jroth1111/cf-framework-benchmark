import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/stays/$id")({
  // Route component is provided by $id.lazy.tsx for code-splitting.
});
