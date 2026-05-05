# Framework Performance Optimizations Research

Date: 2026-03-06
Repo: `/Users/gwizz/CascadeProjects/cf-framework-benchmark`
Scope: Cloudflare Workers benchmark matrix performance research for `angular`, `astro`, `hono`, `next`, `nuxt`, `qwik`, `react`, `react-router`, `redwood`, `solid`, `svelte`, `tanstack-start`, `vike`, `vue`, `waku`

## Executive Summary
- The strongest matrix-wide win is reducing hydrated JavaScript on the `chart` and `media` flows. Across the frameworks, those routes dominate client CPU, memory, and bundle risk.
- The second strongest win is replacing broad prefetch defaults with selective link warming. Global hover/render prefetch repeatedly surfaced as a source of wasted background work.
- The third strongest win is using server loaders, server components, or prerendered/static output for content routes where benchmark policy allows it.
- The biggest caveat is benchmark shape. Several high-impact optimizations, especially prerendering and advanced server-component features, improve speed by changing the runtime profile rather than simply making the same profile more efficient.

## Priority Matrix

### Highest-confidence shared optimizations
1. Split or isolate `chart` route code everywhere it is still eagerly loaded.
2. Keep `media` data server-side or static where possible; hydrate only the interaction surface.
3. Remove global hover/render prefetch defaults and switch to per-link `intent` / `viewport` warming only where needed.
4. Keep first-load data in server loaders or server components instead of post-mount browser fetches.
5. Use prerender/static output for obviously static blog/content routes if benchmark rules permit it.

### Benchmark-policy-sensitive optimizations
1. Prerendering listing/detail routes.
2. Turning fully static pages into non-hydrated HTML.
3. Switching implementation class, for example Solid Vite to SolidStart SSR, or adding heavier Redwood/Waku advanced features.

## Per-Framework Recommendations

### angular
- Highest-value opportunities:
  - Expand hybrid rendering/prerender for static routes.
  - Use incremental hydration and `@defer` carefully on secondary interactive content.
  - Evaluate zoneless mode only if the benchmark permits a broader architecture shift.
- Main caution:
  - Hydration mismatches or over-deferred critical content can harm real interactivity.

### astro
- Highest-value opportunities:
  - Keep static-first rendering for content routes.
  - Avoid introducing unnecessary server islands on primary content.
  - Re-test whether `nodejs_compat` is needed in the Worker target.
- Main caution:
  - Astro is already close to its optimal static profile; extra complexity may buy little.

### hono
- Highest-value opportunities:
  - Keep the app maximally static and HTML-first.
  - Minimize middleware and framework overhead.
  - Consider `hono/tiny` if the feature set still fits.
- Main caution:
  - Avoid adding layers that turn Hono into a pseudo-SSR framework unless the benchmark explicitly needs that.

### next
- Highest-value opportunities:
  - Push client boundaries deeper so only real interactive widgets hydrate.
  - Dynamically import chart/media components.
  - Tune prefetch behavior rather than relying on blanket defaults.
- Main caution:
  - Be careful not to trade direct `/chart` route speed for smaller home-route bundles without measuring both.

### nuxt
- Highest-value opportunities:
  - Use `routeRules`, prerendering, and `noScripts` on static pages.
  - Reduce link prefetch breadth.
  - Remove `nodeCompat` if the built Worker does not need it.
- Main caution:
  - Some optimizations improve static delivery while moving the entry away from runtime-SSR comparability.

### qwik
- Highest-value opportunities:
  - Minimize `useVisibleTask$`.
  - Keep captured serializable state small.
  - Prefer `routeLoader$` and server-first data flow.
- Main caution:
  - Qwik's resumability means React/Svelte-style hydration advice often does not transfer directly.

### react
- Highest-value opportunities:
  - Route-level splitting for every non-home route.
  - Migrate from declarative `<Routes>` to data/framework mode if acceptable.
  - Move prerendering from `renderToString` to React 19 `prerender`.
  - Consider non-hydrated HTML for static routes if benchmark policy allows.
- Main caution:
  - This app currently over-ships JS, but aggressive lazy-loading can penalize direct route-entry timings.

### react-router
- Highest-value opportunities:
  - Add `shouldRevalidate` for static loader routes.
  - Enable `future.v8_splitRouteModules`.
  - Use selective `prefetch="intent"` rather than broad prefetching.
  - Pre-render static routes if allowed.
- Main caution:
  - Pre-rendering and aggressive revalidation suppression are both policy-sensitive choices.

### redwood
- Highest-value opportunities:
  - Keep `"use client"` boundaries as narrow as possible.
  - Use `serverQuery` for data-only client interactions.
  - Experiment with React Compiler.
  - Re-test `nodejs_compat` necessity.
- Main caution:
  - Redwood's advanced RSC features are powerful, but some changes alter the runtime model more than they optimize it.

### solid
- Highest-value opportunities:
  - Split chart and other heavy page-only code first.
  - If a stronger Solid variant is desired, evaluate SolidStart SSR plus `<NoHydration>` / islands.
  - Tighten reactivity in hot paths only after fixing bundle shape.
- Main caution:
  - The current app is not SSR-based, so hydration-focused advice only applies if the implementation class changes.

### svelte
- Highest-value opportunities:
  - Remove global `data-sveltekit-preload-data="hover"`.
  - Prerender and potentially disable CSR for static routes.
  - Dynamically import chart code and simplify reactive update paths.
  - Replace JS-driven stay cards with anchors.
- Main caution:
  - Lower preload aggressiveness may hurt repeat-navigation speed even while improving cold-load efficiency.

### tanstack-start
- Highest-value opportunities:
  - Add measured router/link preloading rather than leaving navigation untuned.
  - Use router structural-sharing/render-optimization features where relevant.
  - Move media data into loaders instead of post-mount fetch.
  - Split chart implementation out of the route shell.
- Main caution:
  - Preloading is useful but easy to over-apply in a benchmark setting.

### vike
- Highest-value opportunities:
  - Keep prerender as the default for static routes.
  - Override global hover-style asset prefetch if cold-load metrics matter more than repeat navigation.
  - Isolate chart code from shared bundles.
- Main caution:
  - Vike already does sensible preload work; custom preload duplication can backfire.

### vue
- Highest-value opportunities:
  - Replace eager route imports with lazy route components.
  - Use Vue 3.5 lazy hydration for heavy SSR islands if route semantics allow.
  - Split chart/media into dedicated async components/chunks.
- Main caution:
  - Micro-optimizing Vue reactivity is secondary until route chunking is fixed.

### waku
- Highest-value opportunities:
  - Keep `'use client'` boundaries extremely small.
  - Fix the chart effect graph so indicator toggles do not refetch price data.
  - Consider smaller client islands or lazy slices for secondary dynamic parts.
- Main caution:
  - Waku is still alpha, so advanced optimization patterns need extra stability scrutiny.

## Best Candidates For Immediate Implementation
- `react`: route-level splitting and React 19 `prerender`.
- `svelte`: remove global hover prefetch and split chart route work.
- `vue`: lazy route components and async chart/media islands.
- `tanstack-start`: loader-first media route and measured route/link preloading.
- `waku`: separate chart fetch dependencies from indicator toggles.
- `react-router`: `shouldRevalidate` on static routes and `v8_splitRouteModules`.

## Best Candidates For Benchmark-Policy Discussion First
- Broad prerender/static expansion across content and listing routes.
- Non-hydrated HTML for static React-family routes.
- SolidStart/islands variant for Solid.
- More aggressive Redwood and Waku advanced-mode experiments.

## Cross-Framework Synthesis
- Corroborated evidence says the matrix should optimize for smaller client surfaces before framework-specific micro-tuning.
- The chart route is the dominant recurring hotspot across React-family, Vue, Solid, Svelte, TanStack Start, Vike, and Waku implementations.
- Prefetch defaults are often set for UX-friendly apps, not benchmark cleanliness. Benchmark entries should treat prefetch as opt-in and measured.
- Cloudflare Workers platform guidance consistently supports streaming and asset-first/static delivery; few findings suggested adding more Worker-side orchestration in front of static assets.

## Contrarian Notes
- Not every speed improvement is a fair benchmark optimization.
- Prerendering and non-hydrated output can dominate results but may turn the comparison into "static export quality" more than framework runtime efficiency.
- The safest recommendations are the ones that keep the same route semantics while shrinking JS and hydration work.

## Artifacts
- Shards: `research/artifacts/shards/*.md`
- Cross-reference: `research/artifacts/cross-reference.md`
- Contrarian review: `research/artifacts/contrarian.md`
