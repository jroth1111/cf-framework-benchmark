import { createFileRoute } from '@tanstack/solid-router'
import { handlePrices } from '@cf-bench/bench-contract'

export const Route = createFileRoute('/api/prices')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => handlePrices(request),
    },
  },
})
