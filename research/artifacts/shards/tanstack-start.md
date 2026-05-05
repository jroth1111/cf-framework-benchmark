### tanstack-start

#### Findings
- The local app is already on TanStack Start's Cloudflare Workers target, but it is not taking advantage of TanStack Router's stronger navigation tuning. [`apps/tanstack-start/app/router.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/tanstack-start/app/router.tsx) creates the router with only `scrollRestoration: true`; it does not set `defaultPreload`, `defaultPreloadDelay`, or `defaultStructuralSharing`. TanStack Router's current docs recommend `defaultPreload: 'intent'` when you want likely-next route dependencies warmed before click, and they document structural sharing / fine-grained selectors as the mechanism to avoid unnecessary rerenders from router state changes. Sources: https://tanstack.com/router/latest/docs/guide/preloading , https://tanstack.com/router/latest/docs/guide/render-optimizations
- The root navigation and home-page CTAs use plain `<Link>` components without per-link preload tuning in [`apps/tanstack-start/app/routes/__root.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/tanstack-start/app/routes/__root.tsx) and [`apps/tanstack-start/app/routes/index.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/tanstack-start/app/routes/index.tsx). TanStack Router's preloading model supports intent and viewport-based warming on links; this is one of the lowest-risk speed knobs available here. Source: https://tanstack.com/router/latest/docs/guide/preloading
- The biggest client bundle risk is the chart route. [`apps/tanstack-start/app/routes/chart.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/tanstack-start/app/routes/chart.tsx) eagerly imports `@cf-bench/chart-core` and `@cf-bench/chart-hooks`, initializes the chart client-side, and performs several effects around deferred values and RAF scheduling. That is the highest-likelihood JS/CPU hotspot in this app.
- The media route is also fully client-driven. [`apps/tanstack-start/app/routes/media.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/tanstack-start/app/routes/media.tsx) fetches `/api/media?pageSize=30` after mount instead of using a route loader. That increases post-hydration work and delays first interactive content on the media page versus server-loaded data.
- TanStack Router's code-splitting guide still recommends separating route components from route definitions when you want cleaner split points and type-safe route API access via `getRouteApi()`. This repo keeps large route logic inline, especially for `/chart` and `/media`, which makes future chunk isolation and reuse less clean. Source: https://tanstack.com/router/latest/docs/guide/code-splitting
- The stays route is using a server loader, which is the right baseline, but it adds purely client-side skeleton/mounted state in [`apps/tanstack-start/app/routes/stays/index.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/tanstack-start/app/routes/stays/index.tsx). That extra render phase is a UX choice rather than a benchmark-speed win and adds hydration work.
- The current Vite config explicitly disables prerendering in [`apps/tanstack-start/vite.config.ts`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/tanstack-start/vite.config.ts). For static routes like `/blog` and perhaps `/`, this leaves potential first-load speed on the table if benchmark policy allows static generation for content routes.

#### Recommendations
- Highest-confidence change: enable selective router preloading.
  - Set `defaultPreload: 'intent'` in [`apps/tanstack-start/app/router.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/tanstack-start/app/router.tsx) only if the benchmark values in-app navigation speed.
  - Otherwise keep global preload off and add per-link `preload="intent"` only on the most likely next-click links from the home page and primary nav.
- Turn on `defaultStructuralSharing: true` in the router if you start using search-param subscriptions or router-state selectors more heavily. This is a low-risk CPU optimization for future filter-heavy routes.
- Split the `/chart` route more aggressively.
  - Move the heavy chart implementation into a lazily imported component module.
  - Keep the route shell and selectors light.
  - Avoid duplicated `setIndicators()` calls across initialization and update effects unless they are required by the chart core.
- Move `/media` data acquisition to a route loader so the page can render with data on first load instead of fetching after mount. Keep only open/next interactions client-side.
- Re-evaluate the mounted/skeleton gating on `/stays`. If benchmark scoring favors immediate useful HTML over animated reveal, render the grid directly from loader data and remove the extra mounted state.
- If benchmark rules permit static output, enable prerender for `/`, `/blog`, and blog detail pages instead of keeping global prerender disabled.

#### Risks
- Global `defaultPreload: 'intent'` can raise background network and memory usage if the benchmark mostly measures cold loads rather than navigation speed.
- Enabling prerender or server loaders on more routes improves speed, but it changes the runtime profile and may reduce comparability against entries that keep everything request-time.
- Over-optimizing chart effects without understanding `@cf-bench/chart-core` invariants could introduce rendering correctness bugs.
- Structural sharing only helps with JSON-compatible selected values; it is not a blanket rerender fix.

#### Gaps
- I did not run a fresh bundle analyzer for `apps/tanstack-start`, so the chart/media chunk leakage into shared bundles is still inferential.
- I did not verify TanStack Start-specific prerender constraints for this exact Cloudflare Workers setup beyond the local config disabling it.
- The app does not currently use search-heavy route subscriptions, so the structural-sharing recommendation is partly anticipatory.

#### Queries Used
- site:tanstack.com/router/latest/docs/framework/react guide code splitting tanstack router
- site:tanstack.com/router/latest/docs/framework/react guide preloading
- site:tanstack.com/router/latest/docs/framework/react guide render optimizations
- TanStack Start Cloudflare Workers prerender performance official

#### Sources
- https://tanstack.com/router/latest/docs/guide/code-splitting
- https://tanstack.com/router/latest/docs/guide/preloading
- https://tanstack.com/router/latest/docs/guide/render-optimizations
