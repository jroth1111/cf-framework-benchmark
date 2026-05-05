### vike

#### Findings
- The local app is globally configured with `prerender: true` in [`apps/vike/pages/+config.ts`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/vike/pages/+config.ts), which is aligned with current Vike guidance: pre-render whenever you can, and opt out only for pages that need request-time rendering. Vike's current docs still explicitly recommend prerendering by default and using `onBeforePrerenderStart()` for parameterized routes. Sources: https://vike.dev/pre-rendering , https://vike.dev/pre-rendering#parameterized-routes
- Because this app uses `vike-react`, client routing is enabled by default. Vike's `+clientRouting` docs state that `vike-react` apps opt into client routing automatically. That makes link prefetch behavior relevant for client memory/network tradeoffs. Source: https://vike.dev/clientRouting
- Vike's current `+prefetchStaticAssets` setting defaults to `'hover'`. The local app does not override this in [`apps/vike/pages/+config.ts`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/vike/pages/+config.ts) or elsewhere. On a benchmark app with many obvious links, default hover prefetch can help navigation but can also create background work and memory residency that does not help cold-load scores. Source: https://vike.dev/prefetchStaticAssets
- The chart page is the main client CPU hotspot. [`apps/vike/pages/chart/+Page.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/vike/pages/chart/+Page.tsx) eagerly imports chart code, initializes a canvas chart client-side, and refetches candles on symbol/timeframe changes. This is the biggest candidate for route-specific code isolation and hydration minimization.
- The media page is already comparatively cheap. [`apps/vike/pages/media/+Page.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/vike/pages/media/+Page.tsx) loads feed items synchronously from local bench data and only hydrates the open/next interactions. That is closer to the ideal benchmark split than several other frameworks in the matrix.
- Vike's preloading docs note that it already injects preload tags and can generate Early Hints automatically. The repo should avoid hand-rolled preload duplication unless there is a measured gap. Source: https://vike.dev/preloading
- Vike explicitly warns against Rollup manual chunking patterns that pull both client runtimes into the same bundle because that hurts initial page speed and can create runtime conflicts. The current app does not appear to do that, which is correct; future bundle-tuning should avoid regressing into shared mega-chunks. Source: https://vike.dev/client-runtimes-conflict

#### Recommendations
- Highest-confidence change: override `prefetchStaticAssets` away from the default global hover behavior.
  - Use `false` globally if the benchmark emphasizes cold-load speed and memory.
  - Or keep it off globally and add per-link `data-prefetch-static-assets="hover"` only on the highest-probability transitions.
- Keep prerender for static routes. Do not back away from the current `prerender: true` default for `/`, `/blog`, and other static content routes.
- Split the chart route more aggressively so chart code does not leak into shared client bundles.
  - Keep the route shell server-rendered.
  - Lazy-load the heavy chart module after navigation or visibility if benchmark policy allows.
- Keep the media page mostly as-is. It already follows a good pattern: SSR/static content first, minimal client logic for interaction timings only.
- Avoid manual chunking in Vite unless a bundle report proves it helps. Vike's own guidance is to avoid chunk setups that over-share runtimes and hurt initial load.
- If navigation speed is part of the benchmark, use Vike's targeted prefetch APIs (`prefetch()` or per-link settings) instead of blanket eager strategies.

#### Risks
- Disabling hover prefetch can slightly slow repeat navigations even as it improves cold-load efficiency.
- More aggressive prerendering improves speed, but it changes the runtime shape toward static output and may affect fairness comparisons.
- Lazy-loading the chart may improve initial load while making first interaction on `/chart` slower if the benchmark starts timing before the chunk is ready.
- Overriding Vike's default preload behavior without measuring can trade one metric for another.

#### Gaps
- I did not measure whether Vike's default hover prefetch is materially affecting this repo's live navigation metrics.
- I did not run a bundle breakdown to confirm whether chart code is isolated from shared page chunks.
- I did not inspect Vike's generated Early Hints or preload tags on live responses for this app.

#### Queries Used
- site:vike.dev pre-rendering Vike
- site:vike.dev client routing Vike
- site:vike.dev prefetchStaticAssets Vike
- site:vike.dev preloading Vike
- site:vike.dev client runtimes conflict Vike

#### Sources
- https://vike.dev/pre-rendering
- https://vike.dev/clientRouting
- https://vike.dev/prefetchStaticAssets
- https://vike.dev/preloading
- https://vike.dev/client-runtimes-conflict
