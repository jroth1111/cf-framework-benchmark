import { createFileRoute } from '@tanstack/solid-router'
import { handleListings } from '@cf-bench/bench-contract'

export const Route = createFileRoute('/api/listings')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => handleListings(request),
    },
  },
})
