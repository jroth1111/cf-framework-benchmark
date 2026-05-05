import { createFileRoute } from '@tanstack/solid-router'
import { lazy } from 'solid-js'
import { benchHeaders } from '../lib/headers'

const Chart = lazy(async () => {
  const mod = await import('../../../solid/src/pages/Chart')
  return { default: mod.Chart }
})

export const Route = createFileRoute('/chart')({
  headers: () => benchHeaders('no-store'),
  component: ChartPage,
})

function ChartPage() {
  return <Chart />
}
