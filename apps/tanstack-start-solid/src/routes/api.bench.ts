import { createFileRoute } from '@tanstack/solid-router'
import { handleBench } from '@cf-bench/bench-contract'

export const Route = createFileRoute('/api/bench')({
  server: {
    handlers: {
      GET: () => handleBench('tanstack-start-solid'),
    },
  },
})
