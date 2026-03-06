import { createFileRoute } from '@tanstack/solid-router'
import { lazy } from 'solid-js'

const Media = lazy(async () => {
  const mod = await import('../../../solid/src/pages/Media')
  return { default: mod.Media }
})

export const Route = createFileRoute('/media')({
  component: MediaPage,
})

function MediaPage() {
  return <Media />
}
