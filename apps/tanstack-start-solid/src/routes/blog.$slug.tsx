import { createFileRoute } from '@tanstack/solid-router'
import { BlogPost } from '../../../solid/src/pages/BlogPost'
import { benchHeaders } from '../lib/headers'

export const Route = createFileRoute('/blog/$slug')({
  headers: () => benchHeaders('public, max-age=0, s-maxage=300'),
  component: BlogPostPage,
})

function BlogPostPage() {
  const params = Route.useParams()
  return <BlogPost slug={params().slug} />
}
