# Cloudflare deployment best practices (per framework)

This repo tries to keep **behavior consistent** across frameworks while using the *idiomatic* Cloudflare adapter/preset for each.

## Cross-cutting (applies to all)

- Prefer **static assets** where possible (SSG/blog) and keep dynamic/SSR limited to routes that need it.
- Keep expensive initialization **out of module scope** unless you benefit from isolate reuse.
- Add lightweight response headers during benchmarking:
  - `Server-Timing` to tag responses (we include an isolate id in many API routes)
  - `Cache-Control` and `CF-Cache-Status` (in production) to reason about cache effects.
- Benchmark both:
  - first request in a fresh browser context (cold cache / first view)
  - subsequent navigation(s) (warm cache / repeat view)

## Framework notes

### React + Vite (MPA via multi-entry build)
- Cloudflare Pages supports static asset hosting with an optional Worker for `/api/*`.
- Use `assets.not_found_handling = "404-page"` for MPA routing (avoid SPA fallback).

### Astro
- Use the official Cloudflare adapter and choose `output: "hybrid"` so you can mix prerendered pages with SSR routes.
- Keep islands hydration scoped (only the chart page needs a client island in this benchmark).

### Next.js (OpenNext for Cloudflare)
- Use an OpenNext-based adapter so Next’s routing and SSR map cleanly to Workers.
- Avoid Node-only APIs; treat runtime as workerd + V8 isolates.

### SvelteKit
- Use `@sveltejs/adapter-cloudflare` and keep server code on web APIs.
- Prefer server `load()` for SSR listings and keep the chart as client-only.

### Qwik
- Qwik’s resumability reduces hydration cost; use visible tasks for client-only work (chart).

### SolidStart / TanStack Start
- Use Cloudflare presets (Vinxi) and avoid Node-specific dependencies.
- For Start-based stacks, use API file routes or server functions for `/api/*` endpoints.

## Benchmark-specific notes

- Chart page intentionally supports:
  - pan + zoom + crosshair
  - timeframe switching
  - indicator toggles (SMA/EMA/volume)

These controls create repeatable user interactions so lab INP and long tasks can be compared across frameworks.
