// cache-control is set by src/server.ts (single source: @cf-bench/bench-cache).
// Route-level headers only emit server-timing default; the worker overrides any
// cache-control value before responding.
export function benchHeaders() {
  return {
    'server-timing': 'cf_bench;dur=0.0',
  }
}
