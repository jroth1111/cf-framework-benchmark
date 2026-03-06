import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/stays')({
  component: StaysLayout,
})

function StaysLayout() {
  return <Outlet />
}
