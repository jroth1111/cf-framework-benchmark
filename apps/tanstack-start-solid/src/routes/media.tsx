import { createFileRoute } from '@tanstack/solid-router'
import { lazy } from 'solid-js'
import { benchHeaders } from '../lib/headers'

const Media = lazy(async () => {
  const mod = await import('../../../solid/src/pages/Media')
  return { default: mod.Media }
})

export const Route = createFileRoute('/media')({
  headers: () => benchHeaders('no-store'),
  component: MediaPage,
})

function MediaPage() {
  return <Media />
}
