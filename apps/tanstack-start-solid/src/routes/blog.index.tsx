import { createFileRoute } from '@tanstack/solid-router'
import { Blog } from '../../../solid/src/pages/Blog'
import { benchHeaders } from '../lib/headers'

export const Route = createFileRoute('/blog/')({
  headers: () => benchHeaders(),
  component: BlogPage,
})

function BlogPage() {
  return <Blog />
}
