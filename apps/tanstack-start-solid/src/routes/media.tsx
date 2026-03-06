import { createFileRoute } from '@tanstack/solid-router'
import { Media } from '../../../solid/src/pages/Media'

export const Route = createFileRoute('/media')({
  component: MediaPage,
})

function MediaPage() {
  return <Media />
}
