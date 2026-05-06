import handler, { createServerEntry } from '@tanstack/solid-start/server-entry'
import { handleContractApi } from '@cf-bench/bench-contract'

function cacheKind(pathname: string) {
  if (pathname === '/stays' || pathname === '/blog') return 'list'
  if (/^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname)) return 'detail'
  if (pathname === '/hifi/stays') return 'hifi-list'
  if (/^\/hifi\/stays\/[^/]+$/.test(pathname)) return 'hifi-detail'
  return null
}

function cacheHeader(pathname: string, profile: string | null) {
  const kind = cacheKind(pathname)
  if (kind === 'hifi-list') return 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
  if (kind === 'hifi-detail') return 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400'
  if (profile === 'idiomatic' || profile === 'mobile-cold') {
    if (kind === 'detail') return 'public, max-age=0, s-maxage=300, stale-while-revalidate=600'
    if (kind === 'list') return 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
  }
  return 'no-store'
}

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
    headers.set('cache-control', cacheHeader(url.pathname, request.headers.get('x-cf-bench-profile')))
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
