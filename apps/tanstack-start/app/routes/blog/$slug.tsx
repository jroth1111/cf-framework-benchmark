import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/blog/$slug")({
  // Route component is provided by $slug.lazy.tsx for code-splitting.
});
