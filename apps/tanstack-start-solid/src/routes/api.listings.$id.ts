import { createFileRoute } from '@tanstack/solid-router'
import { handleListing } from '@cf-bench/bench-contract'

export const Route = createFileRoute('/api/listings/$id')({
  server: {
    handlers: {
      GET: ({ params }: { params: { id: string } }) => handleListing(params.id),
    },
  },
})
