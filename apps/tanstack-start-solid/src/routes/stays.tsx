import { createFileRoute } from '@tanstack/solid-router'
import { Stays } from '../../../solid/src/pages/Stays'

export const Route = createFileRoute('/stays')({
  component: StaysPage,
})

function StaysPage() {
  return <Stays />
}
