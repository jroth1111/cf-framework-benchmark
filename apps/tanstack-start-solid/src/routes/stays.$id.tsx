import { createFileRoute } from '@tanstack/solid-router'
import { StayDetail } from '../../../solid/src/pages/StayDetail'

export const Route = createFileRoute('/stays/$id')({
  component: StayDetailPage,
})

function StayDetailPage() {
  const params = Route.useParams()
  return <StayDetail id={params().id} />
}
