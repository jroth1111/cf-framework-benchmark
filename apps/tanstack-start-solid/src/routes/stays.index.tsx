import { createFileRoute } from '@tanstack/solid-router'
import { Stays } from '../../../solid/src/pages/Stays'
import { benchHeaders } from '../lib/headers'

export const Route = createFileRoute('/stays/')({
  headers: () => benchHeaders('public, max-age=0, s-maxage=60, stale-while-revalidate=300'),
  component: StaysPage,
})

function StaysPage() {
  return <Stays />
}
