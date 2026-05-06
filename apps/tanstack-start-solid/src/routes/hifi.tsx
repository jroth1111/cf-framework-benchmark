import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/hifi')({
  component: HifiLayout,
})

function HifiLayout() {
  return <Outlet />
}
