import { createFileRoute } from '@tanstack/solid-router'
import { Blog } from '../../../solid/src/pages/Blog'

export const Route = createFileRoute('/blog')({
  component: BlogPage,
})

function BlogPage() {
  return <Blog />
}
