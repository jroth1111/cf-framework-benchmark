import { createFileRoute } from '@tanstack/solid-router'
import { Blog } from '../../../solid/src/pages/Blog'
import { benchHeaders } from '../lib/headers'

export const Route = createFileRoute('/blog/')({
  headers: () => benchHeaders('public, max-age=0, s-maxage=60, stale-while-revalidate=300'),
  component: BlogPage,
})

function BlogPage() {
  return <Blog />
}
