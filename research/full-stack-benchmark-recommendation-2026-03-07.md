# Full-Stack Benchmark Recommendation — 2026-03-07

## Scope

This memo compares the non-vanilla full-stack options in the benchmark repo.
It excludes standalone `hono` as the final recommendation target, because that
entry is the minimal baseline rather than a frontend framework choice.

Primary evidence:

- `bench/results.v4.mpa_airbnb.md`
- `bench/results.v4.spa_trading_media.md`
- `results.v4.mpa_airbnb.optimized-variants.full10.md`
- `results.v4.spa_trading_media.optimized-variants.full10.md`

## Decision Summary

- Best integrated full-stack framework: `redwood`
- Best composable performance-first stack: `hono-solid`
- Best cold document-route specialist: `vue-c3`
- Best static/content framework: `astro`
- Best balanced integrated alternative to Redwood: `svelte`

## Recommendation By Use Case

- TradingView clone: `hono-solid`
  - Best fit for heavy client interaction, chart switching, and low client cost.
  - Best integrated alternative: `redwood`.

- Trading journal: `hono-solid`
  - Mixed document and interaction workload still favors the lighter composed stack.
  - Best integrated alternative: `redwood`.

- Airbnb clone: `hono-solid`
  - Best overall balance once warm and mobile-cold SSR routes matter.
  - If first-load document routes are the top priority and Vue is preferred: `vue-c3`.
  - Best integrated alternative: `redwood`.

- Booking.com clone: `hono-solid`
  - Similar to Airbnb, but more search/filter pressure makes the low client cost useful.
  - If the product is mostly SSR search/listing pages with lighter interaction: `vue-c3`.

- Blog or docs site: `astro`
  - Best prerender/content specialist in the matrix.
  - If dynamic/auth features matter more than content publishing: `redwood` or `vue-c3`.

- General SaaS dashboard: `redwood`
  - Best overall integrated choice.
  - If you are willing to own composition for maximum performance: `hono-solid`.

## Option-by-Option Contrast

- `astro`
  - Best for content, docs, and marketing pages.
  - Not the best choice for rich SPA workloads.

- `angular`
  - Functional, but not competitive on performance.
  - Only choose for team or ecosystem reasons.

- `hono-solid`
  - Best overall composable choice.
  - Strongest warm-path and best client-cost profile among serious non-vanilla options.

- `hono-vue`
  - Viable, but consistently behind `vue-c3` and `hono-solid`.
  - No benchmark reason to choose it over `vue-c3`.

- `next`
  - Feature-rich, but a weak benchmark performer.
  - Choose only if ecosystem leverage outweighs raw performance.

- `nuxt`
  - Better than Next in places, but still not a winner.
  - Reasonable if the team is already fully committed to Nuxt.

- `qwik`
  - Interesting architecture, but not a top recommendation from these results.
  - Better fit for experimentation than for the benchmark-winning choice.

- `react`
  - Middling results and clearly behind the best options.
  - Hard to justify on performance grounds.

- `react-router`
  - Better than plain React in this matrix, but still mid-pack.
  - Reasonable if framework-mode React Router is a team preference.

- `redwood`
  - Best integrated full-stack recommendation overall.
  - Best choice if you want one framework instead of a composed stack.

- `solid`
  - Leaner than most integrated options, but superseded by `hono-solid`.
  - If Solid is the goal, the composed stack is the better benchmark choice.

- `svelte`
  - Strong integrated all-rounder and the best non-Redwood fallback.
  - Good choice if you want a full-stack framework but dislike Redwood.

- `tanstack-start`
  - Stable but too heavy for a performance-first recommendation.
  - Mostly an ergonomics choice, not a benchmark choice.

- `tanstack-start-solid`
  - Had some good cold SPA bucket scores, but remains too heavy on JS, heap, and warm behavior.
  - Not recommended if client cost matters.

- `vike`
  - Better than Waku, still not a top-tier recommendation.
  - More interesting for static/prerender leaning setups than for demanding apps.

- `vue`
  - Superseded by `vue-c3`.
  - No benchmark reason to prefer it over `vue-c3`.

- `vue-c3`
  - Best cold document-route specialist among the new optimized variants.
  - Strong choice for Vue-first SSR-heavy sites.
  - Not the best interactive/warm-path option.

- `waku`
  - Generally weak and inconsistent relative to the field.
  - Not recommended from these results.

## What Would Change The Recommendation

- If the final in-progress full 19-target rerun materially changes the main
  SPA rankings, the integrated recommendation could shift slightly.
- If ecosystem, team familiarity, or plugin surface matters more than raw
  client cost, `next`, `nuxt`, or `react-router` may still be rational picks.
- If the primary product is almost entirely prerendered public content, `astro`
  becomes the default recommendation instead of `redwood` or `hono-solid`.
