### astro

#### Findings
- **[astro-F01]** `prerender = true` is the highest-confidence benchmark optimization for Astro-on-Workers when a page shell does not need request-time data. Astro’s on-demand rendering guide says server output can selectively prerender static pages, and Cloudflare’s Astro guide says pages that do not need SSR should be prerendered instead of invoking the Worker on every request. In this repo, `index.astro`, `chart.astro`, `media.astro`, and `blog/index.astro` are currently marked `prerender = false` even though their shells appear request-invariant. — Confidence: HIGH — [On-demand Rendering](https://docs.astro.build/en/guides/on-demand-rendering/) + [Cloudflare Astro guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/) — As-of: Astro 5 / Cloudflare docs current
- **[astro-F02]** Astro’s main client-performance win still comes from shipping no JS unless needed. Astro strips client JS by default and only hydrates explicit `client:*` islands; if this app later introduces framework components, the docs support keeping islands as small as possible and preferring `client:idle`, `client:visible`, or `client:media` over `client:load` for non-critical UI. — Confidence: HIGH — [Islands](https://docs.astro.build/en/concepts/islands/) + [Directives Reference](https://docs.astro.build/en/reference/directives-reference/) + [Client-side scripts](https://docs.astro.build/en/guides/client-side-scripts/) — As-of: Astro 5 docs current
- **[astro-F03]** Astro’s plain processed `<script>` pipeline is a supported optimization path: scripts are bundled, deduplicated, and may be auto-inlined, avoiding framework runtime overhead. For this repo’s chart/media pages, staying with small processed scripts is likely lower CPU/memory than converting the views into hydrated framework islands. — Confidence: HIGH — [Client-side scripts](https://docs.astro.build/en/guides/client-side-scripts/) — As-of: Astro 5 docs current
- **[astro-F04]** For SSR pages with real async work, Astro recommends moving blocking fetches out of top-level page execution so HTML can stream sooner. This becomes more relevant if the benchmark evolves from local dataset imports to remote DB/API fetches on Workers; today’s in-memory dataset reads limit the immediate benefit. — Confidence: MEDIUM — [Streaming to improve page performance](https://docs.astro.build/en/recipes/streaming-improve-page-performance/) [SINGLE-SOURCE] — As-of: Astro 5 docs current
- **[astro-F05]** `server:defer` / server islands are appropriate only for slow or personalized fragments, not primary benchmark content. Astro says server islands improve perceived performance and cacheability of the main page, but each island is fetched separately and large props can force `POST`, which breaks browser caching. — Confidence: HIGH — [Server Islands](https://docs.astro.build/en/guides/server-islands/) — As-of: Astro 5 docs current
- **[astro-F06]** On `@astrojs/cloudflare` 12.6.x, `imageService` defaults to `compile`, so Astro image transforms only work on prerendered routes; on on-demand routes, `astro:assets` image features are disabled unless `imageService: 'cloudflare'` is enabled. — Confidence: HIGH — [Cloudflare integration guide](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) + [Images](https://docs.astro.build/en/guides/images/) — As-of: Astro 5.16 / adapter 12.6 docs
- **[astro-F07]** `nodejs_compat` is a plausible Workers-side optimization target because Cloudflare’s compatibility docs say `nodejs_compat` now enables `nodejs_compat_v2` for recent dates and that v2 increases bundle size. If Astro dependencies do not need Node APIs, removing it or adding `no_nodejs_compat_v2` is worth benchmarking. — Confidence: HIGH — [Cloudflare compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/) — As-of: current Cloudflare docs

#### Recommendations
- Prerender every route shell that does not need `Astro.request`, cookies, or query-param rendering. Strong candidates in this repo are `/`, `/chart`, `/media`, and `/blog`.
- Preserve the current “no framework island unless necessary” approach for chart/media. If interactivity moves into framework components, hydrate only the smallest subtree and default to `client:idle` or `client:visible`.
- Do not use `server:defer` for primary benchmark content. Reserve it for secondary or personalized fragments where an extra fetch is acceptable.
- If remote data-backed SSR is introduced later, restructure slow fetches into child components so the page shell can stream early.
- On the media page, either keep raw `<img>` with explicit `width` / `height` for stability or switch to `astro:assets` plus `imageService: 'cloudflare'` on authorized domains.
- Benchmark `nodejs_compat` removal or `no_nodejs_compat_v2` behind a build/test check because it may reduce Worker bundle weight without changing page behavior.
- Use Astro’s bundle analysis recipe before larger refactors so you can confirm where client JS actually comes from.

#### Risks
- Over-prerendering can silently remove server-side query or cookie behavior and change benchmark semantics.
- Delayed hydration directives can improve page metrics while worsening immediate input latency for benchmark-critical controls.
- Server islands can improve perceived load while adding extra network work and browser cache pitfalls.
- Changing image handling on on-demand routes without `imageService: 'cloudflare'` may produce no transformation benefit.
- Removing `nodejs_compat` can break dependencies even if app code itself does not use Node APIs.

#### Gaps
- No Astro-official source quantified whether server islands reduce total client CPU/memory in interactive benchmark flows.
- No Astro-5-specific Cloudflare benchmark guide was found beyond the official rendering/deployment docs.
- This shard did not inspect built bundle or Worker bundle artifacts, so `nodejs_compat` and script-shape recommendations remain unverified against emitted output.

#### Queries Used
- `Astro 5 performance optimization partial hydration islands latest`
- `Astro SSR Cloudflare Workers performance latest`
- `Astro reduce client JavaScript islands directives performance`
- `site:docs.astro.build Astro performance best practices islands`
- `Astro SSR pitfalls hydration performance memory`
- `Astro latest server islands partial prerender performance`
- `site:docs.astro.build/en/reference/directives-reference client:idle timeout astro 5.16`
- `site:docs.astro.build/en/guides/client-side-scripts Astro script bundling performance`
- `site:docs.astro.build/en/guides/integrations-guide/cloudflare Astro cloudflare image service mode`
- `site:developers.cloudflare.com/workers/configuration/compatibility-flags nodejs_compat`

#### Sources
- [Islands](https://docs.astro.build/en/concepts/islands/) — partial hydration model — current docs — Primary
- [Directives Reference](https://docs.astro.build/en/reference/directives-reference/) — `client:*` directive behavior — current docs — Primary
- [Client-side scripts](https://docs.astro.build/en/guides/client-side-scripts/) — processed script optimization path — current docs — Primary
- [On-demand Rendering](https://docs.astro.build/en/guides/on-demand-rendering/) — prerender vs SSR guidance — current docs — Primary
- [Streaming to improve page performance](https://docs.astro.build/en/recipes/streaming-improve-page-performance/) — streaming guidance for async SSR — current docs — Primary
- [Server Islands](https://docs.astro.build/en/guides/server-islands/) — fragment deferral caveats — current docs — Primary
- [Cloudflare integration guide](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) — adapter and image service behavior — current docs — Primary
- [Images](https://docs.astro.build/en/guides/images/) — image optimization behavior — current docs — Primary
- [Analyze Bundle Size](https://docs.astro.build/en/recipes/analyze-bundle-size/) — measurement guidance — current docs — Primary
- [Cloudflare Astro guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/) — Workers deployment and prerender recommendation — current docs — Primary
- [Cloudflare compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/) — node compatibility and bundle-size caveat — current docs — Primary
