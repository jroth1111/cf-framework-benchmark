### qwik

#### Findings
- **[qwik-F01]** `useVisibleTask$()` is a high-leverage CPU reduction target because Qwik’s current docs explicitly position it as a last resort: it runs eagerly on the client, blocks the main thread, and always forces Qwik core execution before the callback. This repo already uses it in `src/root.tsx`, `src/routes/chart/index.tsx`, and `src/routes/media/index.tsx`, so this is immediately actionable. — Confidence: HIGH — [Qwik best practices](https://qwik.dev/docs/guides/best-practices/) + [Tasks](https://qwik.dev/docs/core/tasks/) + [useVisibleTask tutorial](https://qwik.dev/tutorial/hooks/use-visible-task/) — As-of: Qwik 2 beta docs current
- **[qwik-F02]** Qwik resumability performance depends on minimizing serialized state and closure capture; broad closure capture can force large objects into the serialized payload, and `noSerialize()` remains the supported escape hatch for client-only instances. This is directly relevant to chart/player state in the benchmark routes. — Confidence: HIGH — [Capturing](https://qwik.dev/tutorial/understanding/capturing/) + [noSerialize](https://qwik.dev/tutorial/store/no-serialize/) + [QRL optimizer](https://qwik.dev/tutorial/qrl/optimizer/) — As-of: current docs
- **[qwik-F03]** Qwik City navigation defaults can create avoidable network and memory pressure on dense-link benchmark pages. Current docs say `Link` prefetch can invoke `routeLoader$`, `onGet`, and other server work, and warn that many visible links can trigger too many requests; Qwik also notes that plain `<a>` can give the snappiest interactions because full-page reloads are cheap. — Confidence: HIGH — [Qwik API](https://qwik.dev/docs/api/) + [Routing](https://qwik.dev/docs/routing/) — As-of: current docs
- **[qwik-F04]** The supported way to keep data off the client is still to move it into `routeLoader$()` and render from SSR/SSG. Loaders execute before render, which favors SSR/SSG for list/detail benchmark content and limits browser fetches to truly interactive routes. — Confidence: HIGH — [routeLoader$](https://qwik.dev/docs/route-loader/) + [State](https://qwik.dev/docs/core/state/) — As-of: current docs
- **[qwik-F05]** Qwik’s speculative module fetching and resumability model are production-path optimizations that depend on `q-manifest.json` and the generated bundle graph, so benchmarking outside preview/production under-measures Qwik. — Confidence: HIGH — [Speculative Module Fetching](https://qwik.dev/docs/advanced/speculative-module-fetching/) + [Modules Prefetching](https://qwik.dev/docs/advanced/modules-prefetching/) + [Qwikloader](https://qwik.dev/docs/advanced/qwikloader/) — As-of: current docs
- **[qwik-F06]** On Cloudflare Workers, the biggest platform-side speedup is letting static assets and pre-rendered HTML bypass Worker execution. Workers Static Assets serve matching assets without invoking Worker code, and Qwik static generation still supports `include` / `exclude`, making SSG a strong option for read-mostly benchmark routes. — Confidence: HIGH — [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) + [Cloudflare Qwik framework guide](https://developers.cloudflare.com/workers/frameworks/framework-guides/qwik/) + [Qwik City Static API](https://qwik.dev/api/qwik-city-static/) — As-of: current docs
- **[qwik-F07]** For dynamic HTML on Workers, Cloudflare’s current docs favor header-driven CDN caching over `cache.put()` when tiered/global caching matters because Cache API contents are per-data-center and not tiered; `Cloudflare-CDN-Cache-Control` is the better-supported default for benchmark SSR pages. — Confidence: HIGH — [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) + [How the cache works](https://developers.cloudflare.com/workers/reference/how-the-cache-works/) + [CDN-Cache-Control](https://developers.cloudflare.com/cache/concepts/cdn-cache-control/) — As-of: current Cloudflare docs

#### Recommendations
- Remove root-level `useVisibleTask$()` instrumentation if the benchmark can switch to a Qwik-native resume metric, because it forces eager client execution on every page.
- Treat `useVisibleTask$()` as an island-only escape hatch. Keep it only for browser-only library bootstrap such as the chart canvas, and prefer `intersection-observer` or `document-idle` strategies if acceptable.
- Replace visible-task-based browser listeners with `useTask$()`, `useOn()`, `useOnDocument()`, `useOnWindow()`, or JSX event handlers where possible.
- Narrow closure capture and avoid capturing full stores or large arrays when a small signal/reference is enough.
- Mark heavy client-only instances like chart/player/library objects with `noSerialize()`.
- Prefer `routeLoader$()` plus SSR/SSG for benchmark content routes and keep browser fetches only for interaction-driven routes.
- Use Qwik City static generation for read-mostly routes so Workers Static Assets can bypass Worker execution entirely.
- Tune navigation deliberately: use plain `<a>` where SPA state is unnecessary and use `prefetch="js"` or `prefetch={false}` on dense link grids.
- Benchmark only production builds and verify that the manifest and generated bundle graph assets are correctly served and cached.
- For dynamic SSR pages on Cloudflare, prefer `Cloudflare-CDN-Cache-Control` headers over Worker Cache API writes.

#### Risks
- Removing or delaying `useVisibleTask$()` may improve metrics while changing what the benchmark is measuring if the current probe assumes a generic hydration-complete signal.
- Disabling `Link` prefetch can improve first-load cleanliness while hurting SPA navigation benchmarks.
- Moving more routes to SSG/static assets may improve Cloudflare numbers but can shift the route from SSR-on-worker to edge-static, which changes comparability if the matrix expects server rendering.
- Qwik 2 is still beta in this repo, so generated output details may shift before GA even if the optimization direction is stable.

#### Gaps
- No recent primary source quantified Qwik 2 beta client-memory deltas versus Qwik 1 in realistic apps.
- No current official Qwik doc specifically covered Cloudflare Workers plus `Cloudflare-CDN-Cache-Control` patterns for Qwik City SSR responses.
- Qwik Labs Insights may affect prefetch probabilities, but it was excluded because it is a Labs feature and not clearly benchmark-safe.

#### Queries Used
- `Qwik performance optimization resumability latest`
- `Qwik City Cloudflare Workers performance latest`
- `Qwik reduce client JavaScript performance best practices`
- `site:qwik.dev performance optimization Qwik`
- `Qwik pitfalls performance memory hydration criticism`
- `Qwik latest lazy loading symbols prefetch optimization`
- `site:qwik.dev useVisibleTask performance`
- `site:developers.cloudflare.com/workers/frameworks/framework-guides/qwik`
- `site:developers.cloudflare.com/workers/static-assets Qwik`
- `site:developers.cloudflare.com cache api tiered caching workers`

#### Sources
- [Qwik best practices](https://qwik.dev/docs/guides/best-practices/) — high-level performance guidance and visible-task caution — current docs — Primary
- [Tasks](https://qwik.dev/docs/core/tasks/) — task model and alternatives — current docs — Primary
- [useVisibleTask tutorial](https://qwik.dev/tutorial/hooks/use-visible-task/) — client-eager task semantics — current docs — Primary
- [Capturing](https://qwik.dev/tutorial/understanding/capturing/) — closure capture and serialization — current docs — Primary
- [noSerialize](https://qwik.dev/tutorial/store/no-serialize/) — client-only object escape hatch — current docs — Primary
- [QRL optimizer](https://qwik.dev/tutorial/qrl/optimizer/) — optimizer and symbol splitting implications — current docs — Primary
- [Qwik API](https://qwik.dev/docs/api/) — Link/prefetch behavior — current docs — Primary
- [Routing](https://qwik.dev/docs/routing/) — navigation and link tradeoffs — current docs — Primary
- [routeLoader$](https://qwik.dev/docs/route-loader/) — server-side data loading — current docs — Primary
- [State](https://qwik.dev/docs/core/state/) — state and serialization model — current docs — Primary
- [Speculative Module Fetching](https://qwik.dev/docs/advanced/speculative-module-fetching/) — production prefetch model — current docs — Primary
- [Modules Prefetching](https://qwik.dev/docs/advanced/modules-prefetching/) — manifest-based bundle prefetching — current docs — Primary
- [Qwikloader](https://qwik.dev/docs/advanced/qwikloader/) — resume/bootstrap behavior — current docs — Primary
- [Qwik City Static API](https://qwik.dev/api/qwik-city-static/) — static generation API — current docs — Primary
- [Cloudflare Qwik framework guide](https://developers.cloudflare.com/workers/frameworks/framework-guides/qwik/) — Cloudflare-specific Qwik deployment guidance — current docs — Primary
- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) — bypass Worker for matching assets — current docs — Primary
- [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) — per-DC behavior — current docs — Primary
- [How the cache works](https://developers.cloudflare.com/workers/reference/how-the-cache-works/) — tiered caching caveats — current docs — Primary
- [CDN-Cache-Control](https://developers.cloudflare.com/cache/concepts/cdn-cache-control/) — header-driven cache control — current docs — Primary
