import { createFileRoute } from '@tanstack/solid-router'
import { BlogPost } from '../../../solid/src/pages/BlogPost'

export const Route = createFileRoute('/blog/$slug')({
  component: BlogPostPage,
})

function BlogPostPage() {
  const params = Route.useParams()
  return <BlogPost slug={params().slug} />
}
