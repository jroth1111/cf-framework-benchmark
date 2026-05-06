import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/hifi/stays')({
  component: HifiStaysLayout,
})

function HifiStaysLayout() {
  return <Outlet />
}
