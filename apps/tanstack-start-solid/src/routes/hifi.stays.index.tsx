import { createFileRoute } from '@tanstack/solid-router'
import { queryListings } from '@cf-bench/dataset'
import { renderHifiStaysListBody } from '@cf-bench/hifi-shell'
import { benchHeaders } from '../lib/headers'

export const Route = createFileRoute('/hifi/stays/')({
  headers: () => benchHeaders(),
  component: HifiStaysPage,
})

function HifiStaysPage() {
  const listings = queryListings({ page: 1, pageSize: 12 }).results
  const html = renderHifiStaysListBody(listings)
  return (
    <>
      <script async src="/__bench/sdk/maps.js" />
      <script async src="/__bench/sdk/analytics.js" />
      <div innerHTML={html} />
    </>
  )
}
