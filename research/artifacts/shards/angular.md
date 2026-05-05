### angular

#### Findings
- **[angular-F01]** Angular’s route-level hybrid rendering is the strongest supported performance lever for SSR benchmarks: `RenderMode.Prerender` has faster page loads than SSR and “extremely little overhead per server request”, while `RenderMode.Server` adds per-request work. For a benchmark app currently serving all routes with SSR, moving fixed-content routes to prerender should reduce Workers CPU and improve TTFB. — Confidence: HIGH — [Angular SSR / Hybrid Rendering Guide](https://angular.dev/guide/ssr) — As-of: Angular 21.2 docs
- **[angular-F02]** Incremental hydration is intended to reduce initial JS work. `withIncrementalHydration()` keeps SSR-rendered sections dehydrated until triggers such as `idle`, `viewport`, `interaction`, or `hover`, and Angular states this can produce smaller initial bundles and improve initial load metrics; it also auto-enables event replay. — Confidence: HIGH — [Angular Incremental Hydration Guide](https://angular.dev/guide/incremental-hydration) + [Angular Hydration Guide](https://angular.dev/guide/hydration) — As-of: Angular 21.2 docs
- **[angular-F03]** `@defer` only delivers real bundle-size wins when deferred dependencies are standalone and not referenced elsewhere in the same file; placeholders/loading/error dependencies are eagerly loaded, so careless `@defer` usage can preserve cost instead of removing it. — Confidence: HIGH — [Deferred Loading with `@defer`](https://angular.dev/guide/templates/defer) + [Angular Incremental Hydration Guide](https://angular.dev/guide/incremental-hydration) — As-of: Angular 21.2 docs
- **[angular-F04]** Angular v21’s current guidance is that zoneless is the default direction and removing `zone.js` reduces bundle size and startup overhead, but Angular’s hydration guide still includes older caution text around custom/noop Zone.js support for hydration stability. For this SSR app, zoneless plus hydration is supported-but-verify rather than automatic. — Confidence: MEDIUM — [Angular Zoneless Guide](https://angular.dev/guide/zoneless) + [Angular Hydration Guide](https://angular.dev/guide/hydration) — As-of: Angular 21.2 docs
- **[angular-F05]** Angular’s HTTP transfer cache remains important for SSR page speed: disabling it causes browser requests to run twice, once on the server and again on the client. If Worker-side fetch origins differ from browser-visible origins, `HTTP_TRANSFER_CACHE_ORIGIN_MAP` is the supported way to preserve cache reuse across hydration. — Confidence: HIGH — [withNoHttpTransferCache](https://angular.dev/api/platform-browser/withNoHttpTransferCache) + [withHttpTransferCacheOptions](https://angular.dev/api/platform-browser/withHttpTransferCacheOptions) + [HTTP_TRANSFER_CACHE_ORIGIN_MAP](https://angular.dev/api/common/http/HTTP_TRANSFER_CACHE_ORIGIN_MAP) — As-of: Angular 21.2 docs
- **[angular-F06]** Hydration and incremental hydration are sensitive to DOM mutation. Angular explicitly warns that direct DOM manipulation, `innerHTML`/`outerHTML`, and chart-style libraries such as D3 are common causes of hydration mismatch; `ngSkipHydration` is a last-resort escape hatch rather than a first-choice optimization. — Confidence: HIGH — [Angular Hydration Guide](https://angular.dev/guide/hydration) + [Angular Incremental Hydration Guide](https://angular.dev/guide/incremental-hydration) — As-of: Angular 21.2 docs
- **[angular-F07]** Hydration completion depends on Angular app stability. Unresolved timers, promises, intervals, or pending tasks can delay hydration and trigger `NG0506` after 10 seconds, which in a benchmark can look like unexplained client CPU or delayed interactivity. — Confidence: HIGH — [Angular Hydration Guide](https://angular.dev/guide/hydration) + [Angular Zoneless Guide](https://angular.dev/guide/zoneless) — As-of: Angular 21.2 docs
- **[angular-F08]** `hydrate never` is a supported incremental-hydration mode for SSR-rendered content that should remain static on initial load, but Angular notes it only affects the initial hydration pass; after client-side navigation, normal defer triggers apply again. — Confidence: MEDIUM — [Angular Incremental Hydration Guide](https://angular.dev/guide/incremental-hydration) [SINGLE-SOURCE] — As-of: Angular 21.2 docs

#### Recommendations
- Switch route strategy from “SSR everything” to hybrid rendering first. Fixed benchmark pages are the best candidates for `RenderMode.Prerender`; keep truly per-request pages on `RenderMode.Server` only if the benchmark explicitly needs SSR execution each request.
- Add `withIncrementalHydration()` and target the heaviest interactive islands first, especially chart/canvas/media sections. Use `@defer` with `hydrate on viewport` or `hydrate on interaction` for below-the-fold or non-critical widgets.
- Audit every `@defer` boundary for correctness. Ensure deferred components are standalone and not referenced outside the defer block so the benchmark actually avoids initial JS cost.
- Evaluate zoneless mode as a measured experiment. If `zone.js` is still present in the client build, removing it is one of the clearest Angular-supported ways to reduce payload and startup work, but validate hydration carefully.
- Keep HTTP transfer cache enabled and configure it rather than disabling it. Add `HTTP_TRANSFER_CACHE_ORIGIN_MAP` on the server side if Worker and browser origins differ.
- Refactor DOM-mutating islands before relying on hydration; use defer/incremental hydration boundaries first and `ngSkipHydration` only when mismatch-free hydration is not practical.
- Investigate stability issues by inspecting timers and pending async work first when hydration is slow or inconsistent.

#### Risks
- Changing routes from SSR to prerender can improve benchmark numbers by changing rendering mode rather than by making SSR faster.
- Incremental hydration can backfire if defer boundaries are poorly chosen or placeholder/loading dependencies are still eager.
- Zoneless migration can expose latent change-detection or SSR stability bugs.
- `ngSkipHydration` avoids mismatch errors but also gives up hydration benefits for that subtree.
- Transfer-cache misconfiguration on differing origins can silently trigger duplicate fetches during hydration.

#### Gaps
- No recent Angular-21-specific benchmark data quantified Workers CPU savings for prerender versus SSR versus incremental hydration on Cloudflare Workers.
- No recent primary Cloudflare source was found with Angular-specific SSR performance guidance beyond generic platform/framework support.
- The zoneless/hydration documentation inconsistency remains unresolved by docs alone and still needs repo-local verification.
- This shard did not establish whether the matrix intends to measure “best possible page speed” or “SSR cost under a uniform rendering mode”.

#### Queries Used
- `Angular SSR performance optimization Angular 21 hydration defer latest`
- `Angular 21 Cloudflare Workers SSR performance`
- `Angular 21 reduce bundle size signals zoneless SSR`
- `site:angular.dev Angular SSR performance hydration defer`
- `Angular 21 SSR pitfalls performance memory client CPU`
- `Angular 21 latest rendering strategies incremental hydration defer`
- `site:angular.dev withHttpTransferCacheOptions angular`
- `site:angular.dev HTTP_TRANSFER_CACHE_ORIGIN_MAP angular`
- `site:angular.dev zone.js angular zoneless default v21`
- `site:developers.cloudflare.com angular workers SSR`

#### Sources
- [Angular SSR / Hybrid Rendering Guide](https://angular.dev/guide/ssr) — route-level rendering tradeoffs and prerender guidance — current docs — Primary
- [Angular Hydration Guide](https://angular.dev/guide/hydration) — hydration benefits, mismatch pitfalls, and stability caveats — current docs — Primary
- [Angular Incremental Hydration Guide](https://angular.dev/guide/incremental-hydration) — triggers, event replay, and `hydrate never` — current docs — Primary
- [Deferred Loading with `@defer`](https://angular.dev/guide/templates/defer) — defer constraints and eager placeholder semantics — current docs — Primary
- [Angular Zoneless Guide](https://angular.dev/guide/zoneless) — zone removal and startup/bundle implications — current docs — Primary
- [withNoHttpTransferCache](https://angular.dev/api/platform-browser/withNoHttpTransferCache) — duplicate-request warning when disabled — current docs — Primary
- [withHttpTransferCacheOptions](https://angular.dev/api/platform-browser/withHttpTransferCacheOptions) — supported transfer-cache tuning — current docs — Primary
- [HTTP_TRANSFER_CACHE_ORIGIN_MAP](https://angular.dev/api/common/http/HTTP_TRANSFER_CACHE_ORIGIN_MAP) — origin mapping for SSR/client cache reuse — current docs — Primary
