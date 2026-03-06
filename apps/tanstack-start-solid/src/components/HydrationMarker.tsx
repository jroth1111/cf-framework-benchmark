import { onMount } from 'solid-js'

export function HydrationMarker() {
  onMount(() => {
    const w = window as Window & { __CF_BENCH__?: Record<string, any> }
    w.__CF_BENCH__ = w.__CF_BENCH__ || {}
    const hydration = (w.__CF_BENCH__.hydration = w.__CF_BENCH__.hydration || {})
    hydration.endMs = performance.now()
  })

  return null
}
