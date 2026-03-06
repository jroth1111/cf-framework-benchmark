import { createFileRoute } from '@tanstack/solid-router'
import { handleMedia } from '@cf-bench/bench-contract'

export const Route = createFileRoute('/api/media')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => handleMedia(request),
    },
  },
})
