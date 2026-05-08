import { createFileRoute } from '@tanstack/solid-router'
import { Stays } from '../../../solid/src/pages/Stays'
import { benchHeaders } from '../lib/headers'

export const Route = createFileRoute('/stays/')({
  headers: () => benchHeaders(),
  component: StaysPage,
})

function StaysPage() {
  return <Stays />
}
