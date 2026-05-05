# Cross-Reference

## Corroborated Themes
- Shrink hydrated/client boundaries first.
  - Repeated across astro, next, nuxt, qwik, redwood, solid, svelte, tanstack-start, vike, vue, and waku.
  - Common pattern: keep route shell/content server-rendered or static, isolate chart/media/widgets as the only hydrated client surface.
- Route-level code splitting is the highest-confidence JS reduction.
  - Strongly corroborated for react, react-router, tanstack-start, solid, vue, and indirectly for vike/next/nuxt.
  - The chart route is the dominant client CPU/bundle hotspot across the matrix.
- Global eager prefetch is usually a bad default for benchmark fairness.
  - Svelte, vike, react-router, tanstack-start, and nuxt all surfaced this explicitly.
  - Best-supported pattern is targeted `intent` or per-link warming rather than blanket hover/render prefetch.
- Static/prerender output is the biggest page-speed win for content routes.
  - Supported across astro, next, react-router, svelte, tanstack-start, vike, vue, and waku.
  - Common safe targets: `/`, `/blog`, `/blog/:slug`, sometimes `/stays` and `/stays/:id` if benchmark policy allows.
- Avoid buffering on Workers.
  - Corroborated in hono, next, nuxt, redwood, solid, and Cloudflare docs.
  - Streaming or static assets are better than buffering large HTML/JSON payloads under Worker isolate limits.

## Contradictions
- Prerender more vs preserve runtime comparability.
  - Many frameworks can win materially by prerendering content routes.
  - But several shards note that this changes the benchmark shape and may reduce fairness against runtime-SSR entries.
- Prefetch more vs preload less.
  - Router docs often recommend intent/hover/viewport preloading for faster navigations.
  - Benchmark-oriented analysis consistently warns that global hover/render prefetch inflates memory, background network work, and metric noise.
- Lazy-load chart/media vs preserve first-interaction speed on those routes.
  - Code splitting almost always improves initial route load.
  - But if the benchmark enters `/chart` or `/media` directly and immediately measures interaction, over-lazy loading can move cost onto the critical path.
- Add framework-specific advanced modes vs keep the current benchmark implementation stable.
  - Examples: SolidStart islands, Waku lazy slices, React Compiler, Redwood `serverQuery`.
  - These can be real wins, but some are experimental or change the framework profile enough that they need explicit policy approval.

## Negative Evidence
- `nodejs_compat` removal is not a universal optimization.
  - It surfaced as potentially beneficial in some Worker apps, but only where dependencies do not actually need Node shims.
  - This remains framework- and build-output-specific, not a matrix-wide rule.
- Micro-optimizing reactivity before fixing chunk topology is usually low leverage.
  - Vue, React, Solid, and Svelte all have smaller per-framework rerender tactics.
  - But the stronger evidence points to route splitting and hydration reduction as the first-order wins.
- Replacing framework-native streaming with manual custom SSR plumbing is usually the wrong move.
  - Redwood and several SSR frameworks explicitly caution against bypassing their supported protocol/runtime model.

## High-Value Shared Opportunities
- Split chart/media into isolated route chunks or smaller client islands everywhere they are still eagerly bundled.
- Replace global hover prefetch defaults with per-link intent/viewport prefetch where navigation speed matters.
- Convert obviously static content routes to prerender/static output if benchmark rules allow it.
- Keep data on the server or in route loaders instead of post-mount browser fetches whenever first-load speed is the target.
- Measure chunk boundaries before doing framework-specific micro-optimizations.

## Framework-Specific Outliers
- angular: hybrid rendering, `@defer`, and possibly zoneless mode are the main frontier.
- hono: the biggest gains are architectural minimalism, static assets, and avoiding middleware overhead.
- qwik: reduce `useVisibleTask$` and captured serializable state; its resumability model changes the optimization surface.
- redwood: `serverQuery` and React Compiler are unusually high-leverage compared with other frameworks.
- waku: the main issue is client-island size and effect graph shape, not page rendering mode.
