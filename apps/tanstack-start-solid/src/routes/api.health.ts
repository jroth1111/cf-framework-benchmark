import { createFileRoute } from '@tanstack/solid-router'
import { handleHealth } from '@cf-bench/bench-contract'

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: () => handleHealth(),
    },
  },
})
