import { createFileRoute } from '@tanstack/solid-router'
import { Home } from '../../../solid/src/pages/Home'

export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  return <Home />
}
