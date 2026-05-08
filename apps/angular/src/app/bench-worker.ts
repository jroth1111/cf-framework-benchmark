import { htmlCacheHeaderForPath } from '@cf-bench/bench-cache';

export function applyHtmlHeaders(response: Response, pathname: string, profile: string | null, start: number) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const headers = new Headers(response.headers);
  headers.set('cache-control', htmlCacheHeaderForPath(pathname, profile));
  if (!headers.has('server-timing')) {
    headers.set('server-timing', `cf_bench;dur=${(performance.now() - start).toFixed(1)}`);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
