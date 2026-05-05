export function cacheHeader(pathname: string, profile: string | null) {
  pathname = pathname.replace(/\/+$/, '') || '/';
  const isList = pathname === '/stays' || pathname === '/blog';
  const isDetail = /^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname);

  if (profile === 'idiomatic' || profile === 'mobile-cold') {
    if (isDetail) return 'public, max-age=0, s-maxage=300, stale-while-revalidate=600';
    if (isList) return 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';
  }

  return 'no-store';
}

export function applyHtmlHeaders(response: Response, pathname: string, profile: string | null, start: number) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const headers = new Headers(response.headers);
  headers.set('cache-control', cacheHeader(pathname, profile));
  if (!headers.has('server-timing')) {
    headers.set('server-timing', `cf_bench;dur=${(performance.now() - start).toFixed(1)}`);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
