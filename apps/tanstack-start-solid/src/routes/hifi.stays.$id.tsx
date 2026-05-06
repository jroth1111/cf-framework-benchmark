import { createFileRoute } from '@tanstack/solid-router'
import { onMount } from 'solid-js'
import { getListing } from '@cf-bench/dataset'
import {
  attachHifiBookingForms,
  getHifiStayDetailParts,
} from '@cf-bench/hifi-shell'
import { benchHeaders } from '../lib/headers'

export const Route = createFileRoute('/hifi/stays/$id')({
  headers: () =>
    benchHeaders('public, max-age=0, s-maxage=300, stale-while-revalidate=86400'),
  component: HifiStayDetailPage,
})

function HifiStayDetailPage() {
  const params = Route.useParams()
  const body = () => getHifiStayDetailParts(getListing(params().id)).body

  onMount(() => {
    attachHifiBookingForms()
  })

  return (
    <>
      <script async src="/__bench/sdk/maps.js" />
      <script async src="/__bench/sdk/analytics.js" />
      <div innerHTML={body()} />
    </>
  )
}
