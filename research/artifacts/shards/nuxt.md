### nuxt

#### Findings
- **[nuxt-F01]** The local app uses a minimal Nuxt/Nitro Workers setup with `preset: "cloudflare_module"` and `nodeCompat: true`, but it does not define `routeRules`, prerender targets, or payload/bundle controls in `apps/nuxt/nuxt.config.ts`, leaving several major performance levers unused. — Confidence: MEDIUM — [Nitro Cloudflare deploy docs](https://www.nitro.build/deploy/providers/cloudflare) [SINGLE-SOURCE] — As-of: current Nitro docs
- **[nuxt-F02]** Nuxt route rules support `prerender` and `noScripts`, and current Nuxt rendering docs explicitly describe `noScripts` for disabling Nuxt scripts/JS on selected routes; for read-only routes, this is a strong path to remove client hydration cost. — Confidence: HIGH — [Nuxt server rendering guide](https://nuxt.com/docs/4.x/getting-started/server) + [Nuxt rendering concepts](https://dev.nuxt.com/docs/4.x/guide/concepts/rendering) — As-of: Nuxt 4 docs
- **[nuxt-F03]** The chart route is a likely client CPU hotspot because the page eagerly imports `@cf-bench/chart-core`; Nuxt supports dynamic imports and lazy hydration via `defineLazyHydrationComponent`, which can defer JS and lower initial route cost. — Confidence: HIGH — [Nuxt components guide](https://nuxt.com/docs/4.x/guide/directory-structure/app/components) + [defineLazyHydrationComponent](https://nuxt.com/docs/4.x/api/utils/define-lazy-hydration-component) — As-of: Nuxt 4 docs
- **[nuxt-F04]** Nuxt’s data-fetching docs recommend `useFetch` / `useAsyncData` with `pick` and `transform` to minimize payload crossing the SSR-to-client boundary; this is directly relevant to the media page, which currently hydrates client-side selection logic on top of a fetched collection. — Confidence: HIGH — [Data Fetching](https://nuxt.com/docs/4.x/getting-started/data-fetching) + [useAsyncData](https://nuxt.com/docs/4.x/api/composables/use-async-data) — As-of: Nuxt 4 docs
- **[nuxt-F05]** `NuxtLink` prefetches components, middleware, layouts, and payloads by default when links become visible, and the docs warn that multiple triggers can create unnecessary resource usage. On a benchmark app with dense card/link grids, this can pollute initial route memory and CPU. — Confidence: HIGH — [NuxtLink](https://nuxt.com/docs/4.x/api/components/nuxt-link) — As-of: Nuxt 4 docs
- **[nuxt-F06]** Nitro’s `cloudflare_module` preset is the correct deployment path on Workers, but Cloudflare’s compatibility flag docs state that `nodejs_compat_v2` increases bundle size. Since the repo appears not to rely on Node built-ins in the app layer, `nodeCompat: true` is a plausible avoidable startup/bundle cost. — Confidence: HIGH — [Nitro Cloudflare deploy docs](https://www.nitro.build/deploy/providers/cloudflare) + [Cloudflare compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/) — As-of: current docs
- **[nuxt-F07]** Component islands are not the safest first optimization path here because Nuxt still labels them experimental; route prerendering, `noScripts`, lazy loading, and payload minimization are higher-confidence and better-documented optimizations. — Confidence: MEDIUM — [Nuxt rendering concepts](https://dev.nuxt.com/docs/4.x/guide/concepts/rendering) [SINGLE-SOURCE] — As-of: Nuxt 4 docs

#### Recommendations
- Convert read-only benchmark routes such as `/`, `/stays/**`, and `/blog/**` to hybrid static output with `routeRules`, starting with `prerender: true` and testing `noScripts: true` where full-page navigation is acceptable.
- Remove or disable `nitro.cloudflare.nodeCompat` unless a production Workers build proves it is required by a dependency.
- Extract the chart implementation into a lazily loaded client component instead of eagerly importing `@cf-bench/chart-core` in the page SFC; SSR the shell first.
- Reduce `NuxtLink` prefetch on grid-heavy routes by switching to `prefetch-on="interaction"` or disabling prefetch for large sets of detail-page links.
- Use `useFetch` / `useAsyncData` with `pick` / `transform` so only the fields actually rendered cross into hydration on the routes that remain hydrated.
- Prefer declarative `routeRules` over ad hoc cache behavior for the routes that remain dynamic, then validate actual Workers behavior in the benchmark harness.

#### Risks
- `noScripts: true` disables Nuxt client scripts entirely on those routes, which breaks SPA navigation and browser-side instrumentation there.
- Disabling `nodeCompat` can break transitive dependencies and must be verified with a production Workers build.
- Lazy chart hydration can improve page-speed metrics while delaying immediate interactivity on the chart route.
- Turning down prefetch improves route-isolated benchmark cleanliness but can worsen perceived next-click latency.
- Moving local dataset imports behind server shaping can increase SSR work if routes are not also prerendered or cached.

#### Gaps
- This shard did not run bundle or payload analysis on the repo, so impact ordering is based on code inspection plus official docs rather than measured deltas.
- Official docs are less explicit about exact Cloudflare edge persistence behavior of `routeRules.cache/swr` than they are about generic Nitro rendering features.
- No recent primary Nuxt source in the last 12 months was found promoting component islands as a stable first-line optimization for Nuxt 4.

#### Queries Used
- `Nuxt 4 performance optimization payload hydration latest`
- `Nitro Cloudflare Workers performance best practices latest`
- `Nuxt 4 reduce bundle size lazy hydration latest`
- `site:nuxt.com performance Nuxt latest`
- `Nuxt 4 pitfalls performance memory hydration`
- `Nitro Cloudflare Workers route rules cache performance`
- `site:nuxt.com/docs NuxtLink prefetch performance latest`
- `site:developers.cloudflare.com workers runtime nodejs compatibility performance latest`
- `site:nuxt.com/docs payloadExtraction Nuxt 4 useAsyncData`
- `site:nuxt.com/docs noScripts routeRules Nuxt 4`

#### Sources
- [Nuxt server rendering guide](https://nuxt.com/docs/4.x/getting-started/server) — route rules and server rendering behavior — current docs — Primary
- [Nuxt rendering concepts](https://dev.nuxt.com/docs/4.x/guide/concepts/rendering) — rendering modes, noScripts, islands status — current docs — Primary
- [Nuxt components guide](https://nuxt.com/docs/4.x/guide/directory-structure/app/components) — dynamic imports and lazy component patterns — current docs — Primary
- [defineLazyHydrationComponent](https://nuxt.com/docs/4.x/api/utils/define-lazy-hydration-component) — lazy hydration utility — current docs — Primary
- [Data Fetching](https://nuxt.com/docs/4.x/getting-started/data-fetching) — payload minimization guidance — current docs — Primary
- [useAsyncData](https://nuxt.com/docs/4.x/api/composables/use-async-data) — `pick` / `transform` support — current docs — Primary
- [NuxtLink](https://nuxt.com/docs/4.x/api/components/nuxt-link) — prefetch behavior and triggers — current docs — Primary
- [Nitro Cloudflare deploy docs](https://www.nitro.build/deploy/providers/cloudflare) — Workers preset guidance — current docs — Primary
- [Cloudflare compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/) — Node compatibility bundle-size caveat — current docs — Primary
