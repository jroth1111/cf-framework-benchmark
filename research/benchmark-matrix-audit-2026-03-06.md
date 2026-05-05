# Benchmark Matrix Audit — 2026-03-06

Repo: `/Users/gwizz/CascadeProjects/cf-framework-benchmark`

Inputs reviewed:
- `bench/results.v4.mpa_airbnb.json`
- `bench/results.v4.mpa_airbnb.md`
- `bench/results.v4.spa_trading_media.json`
- `bench/results.v4.spa_trading_media.md`
- local app implementations under `apps/*`
- current framework/platform docs from Cloudflare, Next.js, React Router, Vue, Angular, Nuxt, Qwik, Solid, and SvelteKit

## Executive Summary

- `hono` is not a frontend framework winner here. In this repo it is a Cloudflare Worker rendering HTML strings with vanilla browser JS in `apps/hono/src/render.ts`.
- Among actual framework-owned runtime SSR/SPA entries, `redwood` is the strongest overall performer in the main comparable buckets.
- Among prerender/static-heavy entries, `astro` is the strongest current reference point for low-script delivery. `vike` and `waku` are also heavily prerender/static and should not be mixed into runtime-SSR conclusions without caveats.
- The biggest correctness problem is not speed. `react`, `solid`, and `vue` all have warm MPA failures caused by route handling and hydration behavior, not slow data fetching.
- The biggest performance pattern is oversized client surfaces on `chart` and `media`: eager player images, eager chart setup, large route trees, and broad route/module discovery or prefetch behavior.

## Corrected Classification

### Baselines / custom wrappers

- `hono`: backend-plus-vanilla baseline. Worker-owned HTML rendering and imperative client JS.
- `react`: custom worker + React Router SPA shell, not a framework-owned full-stack runtime.
- `solid`: custom worker + manual route switching + custom client entry loading.
- `vue`: custom worker + `createSSRApp` + manual `vue-router` setup.

### Actual framework-owned runtime/full-stack entries

- `next`
- `nuxt`
- `qwik`
- `react-router`
- `redwood`
- `svelte`
- `tanstack-start`

### Prerender/static-heavy or mixed entries

- `astro`: mixed, but strongly optimized around low-script static delivery.
- `angular`: real framework entry, but notably prerender-heavy in this benchmark.
- `vike`: mostly prerendered.
- `waku`: mostly static/prerendered with client islands.

## Best Actual Frameworks From Current Results

### Main comparable runtime SSR bucket (`mpa_airbnb`)

- Cold: `redwood 0.109`, `solid 0.467`, `vue 0.558`, `react 0.635`, `react-router 0.641`
- Warm: `redwood 0.271`, `svelte 0.294`, `nuxt 0.498`, `tanstack-start 0.660`, `react-router 0.776`

Interpretation:
- `redwood` is the best current runtime/full-stack framework entry.
- `svelte` is the strongest warm runner-up in the full runtime SSR set.
- `next` and `qwik` are only comparable inside their mixed SSR+prerender bucket.

### Main comparable runtime SPA bucket (`spa_trading_media`)

- Cold: `redwood 0.055`, `solid 0.357`, `vue 0.376`, `tanstack-start 0.412`, `react-router 0.504`
- Warm: `redwood 0.139`, `svelte 0.208`, `solid 0.226`, `tanstack-start 0.249`, `react 0.335`

Interpretation:
- `redwood` is also the best current runtime SPA entry.
- `astro` leads the prerender SPA-style bucket, not the runtime SPA bucket.

## Measured Problems

### 1. Warm MPA correctness failures

Observed:
- `react`: 20 warm MPA failures
- `solid`: 18 warm MPA failures
- `vue`: 20 warm MPA failures
- Failure shape: Playwright timeouts waiting for `stay-card`, `stay-description`, `blog-post-card`, and `blog-html`

Local causes:
- `react` is effectively a SPA shell for document routes and keeps `assets.not_found_handling = "single-page-application"` in `apps/react/wrangler.toml`. Cloudflare’s SPA mode serves `/index.html` for unmatched navigation requests and can bypass the Worker on navigations depending on configuration. The current setup is hostile to “hard SSR document route” semantics.
- `solid` SSRs HTML but then clears the server DOM and calls `render()` on the client in `apps/solid/src/entries/mount.tsx` instead of hydrating. Solid’s own docs describe `render()` as a browser entry point where the mount element should be empty.
- `vue` is closer to correct SSR hydration, but the worker only treats exact non-trailing-slash paths as benchmark routes. Any normalization mismatch can fall through to asset serving.

Priority: BLOCKING

## 2. Oversized chart/media client surfaces

Observed:
- Worst cold SPA media LCP: `react` at about `1196ms p50`
- Worst cold SPA media CPU: `vike` at about `395.67ms p50`
- Worst warm SPA chart heap: `angular` at about `7.5MB p50`
- Many frameworks hydrate the full media feed plus the player and render the first thumbnail immediately

Local causes:
- `angular` eagerly imports all benchmark pages through a monolithic route/component bundle.
- `react` hydrates a full `BrowserRouter` shell with static imports for every page and eagerly renders 30 media cards plus the selected player image.
- `next` disables link prefetch correctly, but `app/media/MediaClient.tsx` is a large `"use client"` island that hydrates the entire feed/player.
- `tanstack-start` appears to pay for a broad generated route tree in the client.
- `vike` and `waku` both hydrate large client islands for media/chart and eagerly initialize heavy work.

Priority: HIGH

## 3. Prefetch and route-discovery overhead

Observed:
- `react-router` is cleaner than plain React, but it still trails the leaders and uses `prefetch="intent"` broadly, including dense listing/blog grids.
- `svelte` is competitive warm, but the framework defaults make it easy to over-prefetch if left broad.
- `nuxt` performs better because this repo already disables prefetch on its links.

Docs-backed guidance:
- React Router documents `prefetch="none" | "intent" | "render" | "viewport"` and notes that `intent` triggers on hover/focus.
- React Router lazy route discovery eagerly discovers all rendered links unless `discover="none"` is set.
- SvelteKit documents that the default template uses `data-sveltekit-preload-data="hover"` on `<body>`, and explains how to downgrade or disable preloading.
- Nuxt documents `noPrefetch` / `prefetch={false}` and `prefetchOn` controls on `NuxtLink`.

Priority: HIGH

## 4. Mixed implementation classes are skewing conclusions

Observed:
- The benchmark currently mixes:
  - backend-plus-vanilla (`hono`)
  - custom wrappers (`react`, `solid`, `vue`)
  - runtime frameworks (`redwood`, `react-router`, `svelte`, `nuxt`, `tanstack-start`, `qwik`, `next`)
  - prerender/static-heavy entries (`astro`, `vike`, `waku`, much of `angular`)

Impact:
- “Best framework” depends on whether you mean:
  - best minimal Worker baseline
  - best runtime full-stack framework
  - best prerender/static delivery framework

Priority: HIGH for interpretation, not code correctness

## Research-Backed Mitigations

### Do now

1. Fix route reload correctness before chasing more micro-performance.
- `react`: remove SPA fallback semantics from benchmark document routes. Keep these routes on a hard Worker SSR path; do not let missing-route navigation degrade to `/index.html`.
- `solid`: switch client attach from `render()` to hydration and stop clearing SSR HTML on boot.
- `vue`: normalize slash variants and keep all benchmark document routes on the SSR path.

2. Shrink chart/media islands instead of tuning internals first.
- `next`, `react`, `waku`, `vike`: hydrate only the interactive controls/player state, not the whole feed/player shell.
- Delay first player image and chart bootstrap until visibility or interaction where the benchmark still allows it.
- Split `chart-core` and route-only code out of shared chunks.

3. Cut link/module discovery on dense grids.
- `react-router`: change dense card grids from `prefetch="intent"` to `prefetch="none"` or use `discover="none"` selectively.
- `svelte`: avoid global hover preloading for benchmark-heavy link surfaces; prefer `tap` or disable where route data goes stale quickly.
- `nuxt`: keep `no-prefetch` on benchmark links unless a route truly benefits.

4. Re-audit `nodejs_compat`.
- Cloudflare’s compatibility docs note that `nodejs_compat_v2` bundles additional polyfills/globals and increases bundle size.
- Only keep it where a framework adapter or package actually requires it. Otherwise remove it or disable `nodejs_compat_v2` explicitly.

### Next wave

1. Angular
- Split monolithic `bench-pages.ts` by route.
- Use lazy routes / `loadComponent`.
- Consider incremental hydration for deferred islands.
- If still on v20 behavior, evaluate zoneless change detection; Angular docs say ZoneJS adds payload/startup overhead, and zoneless is default in v21+.

2. Next
- Push `"use client"` deeper. Next docs state that once a file is marked `"use client"`, all imports and child components become part of the client bundle.
- Use lazy loading for chart/media client pieces.

3. Qwik
- Move more first-load data into `routeLoader$`; Qwik docs state loaders run on the server and start before rendering.
- Avoid broad `useVisibleTask$` usage; Qwik docs call it an eager client escape hatch that should be used cautiously.

4. Vue / Nuxt
- Use Vue 3.5 lazy hydration strategies such as `hydrateOnVisible` for non-critical SSR islands.
- Use Nuxt `routeRules` and `noScripts` aggressively on routes that can truly ship as content-first pages.

5. SvelteKit
- Use page-level `prerender`, `ssr`, and especially `csr = false` for routes that do not need client JS.
- The docs explicitly note that disabling CSR ships no JavaScript for the page.

## Priority Order

1. Fix `react`/`solid`/`vue` document-route correctness.
2. Split/trim chart and media client surfaces.
3. Reduce dense-link prefetch/discovery behavior.
4. Re-audit `nodejs_compat` flags.
5. Re-run the benchmark only after the above; current rankings for some entries are polluted by avoidable correctness/pathology issues.

## Methodology and Caveats

- Local code inspection was used to map benchmark anomalies back to concrete route/hydration behavior.
- Official docs were used for mitigation guidance. Priority sources:
  - Solid render docs: https://docs.solidjs.com/reference/rendering/render
  - Vue async components + lazy hydration: https://vuejs.org/guide/components/async
  - Vue Router history mode caveats: https://router.vuejs.org/guide/essentials/history-mode
  - Angular incremental hydration: https://angular.dev/guide/incremental-hydration
  - Angular zoneless: https://angular.dev/guide/zoneless
  - Nuxt rendering + route rules: https://nuxt.com/docs/3.x/guide/concepts/rendering
  - NuxtLink prefetch controls: https://nuxt.com/docs/3.x/api/components/nuxt-link
  - React Router lazy route discovery: https://reactrouter.com/explanation/lazy-route-discovery
  - React Router `Link` prefetch behavior: https://reactrouter.com/api/components/Link
  - Next server/client component boundaries: https://nextjs.org/docs/app/getting-started/server-and-client-components
  - Next lazy loading: https://nextjs.org/docs/app/guides/lazy-loading
  - Qwik `routeLoader$`: https://qwik.dev/docs/route-loader/
  - Qwik tasks / `useVisibleTask$`: https://qwik.dev/docs/core/tasks/
  - Cloudflare SPA routing: https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/
  - Cloudflare HTML handling: https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/
  - Cloudflare compatibility flags: https://developers.cloudflare.com/workers/configuration/compatibility-flags/

- One deep-research shard hit an agent usage limit mid-run. Its subject area (route reload reliability) was completed manually from local code plus official docs instead of being dropped.
