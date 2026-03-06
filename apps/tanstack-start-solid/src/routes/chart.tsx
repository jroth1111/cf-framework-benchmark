import { createFileRoute } from '@tanstack/solid-router'
import { lazy } from 'solid-js'

const Chart = lazy(async () => {
  const mod = await import('../../../solid/src/pages/Chart')
  return { default: mod.Chart }
})

export const Route = createFileRoute('/chart')({
  component: ChartPage,
})

function ChartPage() {
  return <Chart />
}
