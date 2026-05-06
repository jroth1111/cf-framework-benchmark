import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/hifi/stays/$id")({
  // Route component is provided by $id.lazy.tsx for code-splitting.
});
