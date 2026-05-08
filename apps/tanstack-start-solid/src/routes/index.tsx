import { createFileRoute } from '@tanstack/solid-router'
import { Home } from '../../../solid/src/pages/Home'
import { benchHeaders } from '../lib/headers'

export const Route = createFileRoute('/')({
  headers: () => benchHeaders(),
  component: IndexPage,
})

function IndexPage() {
  return <Home />
}
