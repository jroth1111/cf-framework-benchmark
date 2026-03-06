import { createFileRoute } from '@tanstack/solid-router'
import { Chart } from '../../../solid/src/pages/Chart'

export const Route = createFileRoute('/chart')({
  component: ChartPage,
})

function ChartPage() {
  return <Chart />
}
