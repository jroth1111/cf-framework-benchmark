### solid

#### Findings
- The current `apps/solid` app is a client-rendered multi-entry Vite app using `render(...)`, not SSR hydration. That means "fine-grained hydration" optimizations will not materially help this repo's current Solid variant unless you introduce SSR/SolidStart first.
- If you do add SSR, the most Solid-specific lever for reducing client CPU/memory is shrinking the hydrated surface area. Solid's `<NoHydration>` skips client hydration for server-rendered static regions, and SolidStart currently exposes islands mode via `experimental.islands`. Solid core also documents that non-hydrating sections avoid client-side reactive management and can avoid serializing some server-only resource data. Sources: https://docs.solidjs.com/reference/components/no-hydration , https://docs.solidjs.com/solid-start/reference/config/define-config , https://github.com/solidjs/solid/releases
- For SSR on Workers, Solid's `renderToStream` aligns well with Cloudflare's streaming model. Cloudflare's current guidance is also explicit that streaming avoids buffering responses in memory, which matters under the 128 MB isolate limit and startup-time constraints. Sources: https://docs.solidjs.com/reference/rendering/render-to-stream , https://developers.cloudflare.com/workers/platform/limits/ , https://developers.cloudflare.com/workers/examples/spa-shell/
- Route/module splitting is the highest-confidence win available without a framework rewrite. Solid's `lazy()` returns a component with `.preload()`, and Solid Router now documents intent-based preloading: hover waits about 20 ms, focus preloads immediately, and nested lazy components need explicit `preload()` if you want them warmed too. Sources: https://docs.solidjs.com/reference/component-apis/lazy , https://docs.solidjs.com/solid-router/advanced-concepts/preloading , https://docs.solidjs.com/solid-router/advanced-concepts/lazy-loading
- Solid Router's `query`/`preload` APIs reduce duplicate fetches and client work by caching preloaded results, deduping repeated SSR calls within a request, and reusing SSR-provided data during hydration. This is more relevant if the benchmark moves from static multi-entry pages toward router-based SSR. Sources: https://docs.solidjs.com/solid-router/reference/data-apis/query , https://docs.solidjs.com/solid-router/data-fetching/how-to/preload-data
- On the client, Solid's main performance footguns remain reactive over-allocation and unnecessary listeners. Current docs still recommend batching related updates, using stores for nested state, and preferring delegated `onClick`-style handlers for dense lists. Native `on:` listeners are better for occasional/high-frequency events where delegation does not help. Sources: https://docs.solidjs.com/reference/reactive-utilities/batch , https://docs.solidjs.com/concepts/stores , https://docs.solidjs.com/concepts/components/event-handlers
- Recent Solid release notes still matter here: Solid 1.8 added hydration-path improvements and reduced redundant prop/attribute setting during hydration. That helps if you adopt SSR, but it is not a substitute for cutting hydrated DOM or shipped JS. Source: https://github.com/solidjs/solid/releases

#### Recommendations
- For the existing benchmark app, prioritize JS reduction first:
  - Dynamically import the chart and any heavy page-only code paths instead of bundling them into shared startup code.
  - Keep the current multi-entry setup unless the benchmark explicitly wants SPA-router behavior; it already gives you coarse page-level code splitting.
- If the benchmark matrix wants a stronger "optimized Solid on Workers" variant, add a separate SolidStart/SSR flavor rather than mutating this app in place:
  - Use SolidStart with the Cloudflare Workers preset.
  - Use streaming SSR (`renderToStream` / default stream mode).
  - Mark static chrome, article bodies, and non-interactive benchmark sections as non-hydrating islands.
  - Keep only genuinely interactive widgets hydratable.
- If you move to router-based navigation:
  - Use `lazy()` for route components.
  - Add route `preload` functions for data.
  - Call nested component `.preload()` for obvious hover/focus flows like chart/detail pages.
- Tighten client reactivity in hot paths:
  - Collapse duplicate `createEffect` work.
  - Batch related state writes.
  - Avoid per-row closures/listeners in large tables when delegated handlers work.
  - Be careful with high-frequency delegated events like `mousemove`; use native `on:` when the listener should stay local.
- For Workers delivery:
  - Stream HTML/bootstrap payloads instead of buffering.
  - Keep Worker startup scope minimal and bundle size small.
  - If using SolidStart server-function serialization, prefer `json` for CSP safety and `js` only when payload size/perf gains are worth `unsafe-eval`. Source: https://docs.solidjs.com/solid-start/reference/config/define-config

#### Risks
- `experimental.islands` in SolidStart is still explicitly marked experimental in current docs, so adopting it in a benchmark may improve page-speed numbers while increasing maintenance risk.
- Switching this repo's Solid app from static multi-entry rendering to SolidStart/router SSR changes the benchmark shape, not just its implementation. That may reduce comparability against other entries.
- Over-eager preloading can shift work earlier without reducing total work; Solid Router docs explicitly caution to validate real user flows before manually preloading lots of bundles.
- `<NoHydration>` and islands require discipline around server/client boundaries; APIs like `createUniqueId` can mismatch if called inconsistently across hydrated vs non-hydrated paths.

#### Gaps
- I did not find strong last-12-month benchmark data specifically comparing SolidStart-on-Workers islands vs plain Solid Vite on identical app workloads; most solid evidence is official docs/release notes rather than independent measurements.
- The repo's current Solid app does not appear to use `@solidjs/router`, so router-specific recommendations are forward-looking unless the benchmark variant is restructured.
- I did not verify current `vite-plugin-solid` compiler flags beyond the default plugin usage in this repo; there may be additional compile-time tuning options worth a follow-up pass in primary plugin docs.

#### Queries Used
- SolidJS performance optimization latest fine-grained hydration
- SolidStart or SolidJS SSR Cloudflare Workers performance latest
- SolidJS reduce client JavaScript hydration performance latest
- `site:docs.solidjs.com performance Solid latest`
- SolidJS pitfalls performance memory latest
- Solid router code splitting lazy hydration latest
- `site:docs.solidjs.com NoHydration solid docs`
- `site:developers.cloudflare.com workers streams performance`
- `site:github.com/solidjs/solid/releases hydration improvements`

#### Sources
- https://docs.solidjs.com/reference/components/no-hydration
- https://docs.solidjs.com/reference/rendering/render-to-stream
- https://docs.solidjs.com/reference/component-apis/lazy
- https://docs.solidjs.com/solid-router/advanced-concepts/preloading
- https://docs.solidjs.com/solid-router/reference/data-apis/query
- https://docs.solidjs.com/solid-start/reference/config/define-config
- https://docs.solidjs.com/concepts/components/event-handlers
- https://docs.solidjs.com/reference/reactive-utilities/batch
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/examples/spa-shell/
- https://github.com/solidjs/solid/releases
