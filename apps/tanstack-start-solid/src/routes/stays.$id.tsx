import { createFileRoute } from '@tanstack/solid-router'
import { StayDetail } from '../../../solid/src/pages/StayDetail'
import { benchHeaders } from '../lib/headers'

export const Route = createFileRoute('/stays/$id')({
  headers: () => benchHeaders('public, max-age=0, s-maxage=300, stale-while-revalidate=600'),
  component: StayDetailPage,
})

function StayDetailPage() {
  const params = Route.useParams()
  return <StayDetail id={params().id} />
}
