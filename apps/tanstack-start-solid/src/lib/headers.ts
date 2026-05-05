export function benchHeaders(cacheControl: string) {
  return {
    'cache-control': cacheControl,
    'server-timing': 'cf_bench;dur=0.0',
  }
}
