import handler, { createServerEntry } from '@tanstack/solid-start/server-entry'
import { handleContractApi } from '@cf-bench/bench-contract'
import { htmlCacheHeaderForPath } from '@cf-bench/bench-cache'

export default createServerEntry({
  async fetch(request: Request) {
    const start = performance.now()
    const url = new URL(request.url)
    if (url.pathname.startsWith('/__bench/')) {
      const benchResponse = handleContractApi('tanstack-start-solid', request)
      if (benchResponse) return benchResponse
    }
    const response = await handler.fetch(request)
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) {
      return response
    }

    const headers = new Headers(response.headers)
    headers.set('cache-control', htmlCacheHeaderForPath(url.pathname, request.headers.get('x-cf-bench-profile')))
    if (!headers.has('server-timing')) {
      headers.set('server-timing', `cf_bench;dur=${(performance.now() - start).toFixed(1)}`)
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  },
})
