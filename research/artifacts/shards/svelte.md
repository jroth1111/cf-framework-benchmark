### svelte

#### Findings
- Current SvelteKit guidance still favors SSR/server `load` over SPA-style client fetching for first-load performance. Official docs state universal `load` runs once during SSR and again during hydration, while server `load` stays server-side; they also recommend server `load` to avoid browser waterfalls and note SPA mode adds extra round trips before first paint. This repo is already mostly on `+page.server.ts`, which is the right baseline for Workers. Sources: https://svelte.dev/docs/kit/load, https://svelte.dev/docs/kit/performance
- The repo is paying unnecessary client/network cost from global hover preloading. `src/app.html` sets `data-sveltekit-preload-data="hover"` on `<body>`, and SvelteKit docs explicitly warn hover preloading can create false positives and stale data; `tap` or code-only preloading is the lighter option for lower-probability navigations. Source: https://svelte.dev/docs/kit/link-options
- Several routes that appear effectively static are not taking the strongest SvelteKit page-size optimization. Current docs say `prerender = true` removes routes from the dynamic SSR manifest, making the serverless/edge bundle smaller, and `csr = false` ships no client JavaScript at all. In this repo, `/blog` and `/blog/[slug]` are explicitly `prerender = false` despite the app copy saying "blog prerender". Source: https://svelte.dev/docs/kit/page-options
- The most likely client CPU hotspot is the chart route, not Workers SSR. SvelteKit's performance guide recommends dynamic `import(...)` for selective loading, and Svelte 5's runtime model is effect-granular rather than component-wide. The current chart page eagerly imports chart code and has two broad reactive blocks that can both call `chart.setIndicators`, increasing main-thread work during interaction. Sources: https://svelte.dev/docs/kit/performance, https://svelte.dev/docs/svelte/lifecycle-hooks
- For navigation-heavy benchmark flows, plain anchors are cheaper and better aligned with SvelteKit than `div` + `goto`. SvelteKit uses standard `<a>` navigation with `data-sveltekit-*` options; the current `/stays` page adds JS click/keydown handlers plus fallback navigation for every card. Replacing these with anchors reduces listeners and preserves native behavior while still allowing tuned preloading. Source: https://svelte.dev/docs/kit/link-options
- For partial UI state, shallow routing and snapshots are now mature enough to use instead of full route transitions or ad hoc retained component state. Shallow routing can push history state without navigation, and snapshots preserve ephemeral DOM state such as input contents across navigation. This is relevant if benchmark scenarios expand to modal/detail or filter-state flows. Sources: https://svelte.dev/docs/kit/shallow-routing, https://svelte.dev/docs/kit/snapshots
- Cloudflare's current Workers guidance supports the deployment model already used here: static assets in `.svelte-kit/cloudflare` are automatically cached across the edge, and keeping `run_worker_first = false` prioritizes fast asset delivery. That means app wins should come mainly from reducing shipped JS and hydration work, not from extra Worker routing logic in front of assets. Sources: https://developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit/, https://developers.cloudflare.com/workers/static-assets/, https://developers.cloudflare.com/workers/static-assets/binding/
- Cloudflare isolate memory remains 128 MB per isolate, shared across concurrent requests. For this app, that raises the bar for avoiding large in-memory SSR payloads and for streaming non-essential data, but it does not change the primary client-side recommendation set. Sources: https://developers.cloudflare.com/workers/platform/limits/, https://svelte.dev/docs/kit/performance

#### Recommendations
- Highest impact: remove global `data-sveltekit-preload-data="hover"` from `apps/svelte/src/app.html`; reintroduce preloading selectively:
  - use `data-sveltekit-preload-data="tap"` on high-intent links/forms
  - use `data-sveltekit-preload-code="viewport"` or `hover` for likely-next navigations where code warmup helps but data prefetch is wasteful
- Convert clearly static content to static output:
  - set `prerender = true` for `/blog` and prerenderable blog detail pages
  - set `csr = false` on routes that do not need client interactivity
  - this directly cuts JS shipped, hydration CPU, and dynamic manifest size
- Keep route data in `+page.server.ts` unless browser-only fetch is genuinely required. Do not move benchmark data flows into universal `load` for convenience; that would reintroduce hydration/browser waterfall cost.
- Split the chart route more aggressively:
  - lazy-load `@cf-bench/chart-core` and any heavy chart-only helpers inside `onMount` via dynamic import
  - consolidate chart update paths so indicator changes and candle changes do not trigger overlapping mutations
  - prefer the narrowest possible Svelte 5 effects/state dependencies over broad reactive blocks
- Replace `/stays` clickable `div` cards with real `<a href="/stays/[id]">` cards. Keep SvelteKit navigation semantics and add only targeted preload attributes if needed.
- If any route has slow secondary data, return promises from server `load` and stream non-essential sections after first render instead of blocking TTFB/LCP.
- Preserve Cloudflare assets-first delivery. Do not introduce `run_worker_first = true` globally for this benchmark app; it would add asset latency and work against the platform's current fast-path guidance.
- Where images matter for LCP or payload size, adopt `@sveltejs/enhanced-img` or equivalent responsive image generation; SvelteKit docs explicitly call this out as one of the highest-impact page-speed wins.

#### Risks
- Disabling CSR on a route is a hard cut: no progressive enhancement, no client router on that page, and all `<script>` in components are removed. Only apply it to fully static views.
- Reducing preload aggressiveness can slightly worsen repeat-navigation latency if benchmark flows assume immediate next-click navigations. Measure with and without hover preload before standardizing.
- Shallow routing is JS-dependent and state is empty on first SSR landing; it should be treated as an enhancement, not a correctness dependency.
- Dynamic-importing chart code improves initial page speed but can worsen first interaction on the chart route if the benchmark measures route-open-to-interactive without allowing warmup.
- Prerendering dynamic-looking routes requires a stable content set at build time; otherwise the benchmark may measure stale output rather than live SSR.

#### Gaps
- I did not find a recent official Svelte 5 document that quantifies hydration/runtime gains from runes with benchmark numbers; the strongest evidence is architectural guidance from the lifecycle/runtime docs, not fresh measured deltas.
- I did not validate this repo's production bundle composition or route-level JS weights locally, so "highest impact" is evidence-based but still inferential until confirmed with a production build analyzer.
- Cloudflare's current SvelteKit Workers guide is deployment-oriented, not a benchmark tuning guide, so platform-specific optimization advice is mostly about asset routing/caching rather than Svelte-specific CPU reductions.

#### Queries Used
- SvelteKit 2 performance optimization latest cloudflare
- Svelte 5 performance runes hydration optimization latest
- SvelteKit reduce client JavaScript page speed latest
- site:svelte.dev docs performance SvelteKit latest
- SvelteKit pitfalls performance memory latest
- SvelteKit shallow routing data loading performance latest
- site:developers.cloudflare.com/workers SvelteKit Cloudflare Workers guide
- site:developers.cloudflare.com/workers/static-assets Workers static assets cache
- site:developers.cloudflare.com/workers/platform/limits memory CPU time Workers

#### Sources
- SvelteKit Performance Docs: https://svelte.dev/docs/kit/performance
- SvelteKit Link Options Docs: https://svelte.dev/docs/kit/link-options
- SvelteKit Load Docs: https://svelte.dev/docs/kit/load
- SvelteKit Page Options Docs: https://svelte.dev/docs/kit/page-options
- SvelteKit Shallow Routing Docs: https://svelte.dev/docs/kit/shallow-routing
- SvelteKit Snapshots Docs: https://svelte.dev/docs/kit/snapshots
- Svelte Lifecycle Hooks / Svelte 5 runtime model: https://svelte.dev/docs/svelte/lifecycle-hooks
- SvelteKit Images Docs: https://svelte.dev/docs/kit/images
- Cloudflare Workers SvelteKit Guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit/
- Cloudflare Workers Static Assets Docs: https://developers.cloudflare.com/workers/static-assets/
- Cloudflare Static Asset Routing / `run_worker_first`: https://developers.cloudflare.com/workers/static-assets/binding/
- Cloudflare Workers Limits: https://developers.cloudflare.com/workers/platform/limits/
