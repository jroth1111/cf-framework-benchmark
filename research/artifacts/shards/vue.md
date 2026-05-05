### vue

#### Findings
- The local app eagerly imports every route component in [`apps/vue/src/router/index.ts`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/vue/src/router/index.ts). Vue's official performance guide still recommends code splitting with dynamic import for route-level chunks, and Vue Router works directly with lazy-loaded route components. This is the clearest current bundle-size problem in the repo's Vue implementation. Sources: https://vuejs.org/guide/best-practices/performance.html#code-splitting , https://router.vuejs.org/guide/advanced/lazy-loading.html
- The app is SSR-capable but not taking advantage of Vue 3.5's newer lazy-hydration controls. Vue's async component docs now support `hydrateOnVisible`, `hydrateOnIdle`, `hydrateOnInteraction`, and related strategies for SSR apps. For this benchmark, heavy interactive islands like chart/media controls are the main candidates. Source: https://vuejs.org/guide/components/async.html#lazy-hydration
- The chart page is a major client CPU hotspot. [`apps/vue/src/views/ChartPage.ts`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/vue/src/views/ChartPage.ts) eagerly imports `@cf-bench/chart-core`, sets up watchers over symbol/timeframe and indicator state, and pushes updates directly to the canvas chart. This is the route most likely to benefit from async-component splitting and narrower reactive updates.
- The media page is relatively efficient in data flow but still fully included in the main route bundle because of eager imports. [`apps/vue/src/views/MediaPage.ts`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/vue/src/views/MediaPage.ts) reads bench data synchronously and only manages selected-item state client-side, which is a good rendering pattern once chunking is fixed.
- Vue's performance guide still recommends props stability, `v-once`, `v-memo`, and reducing reactivity overhead for large immutable structures. The current app is written largely in render functions without component boundaries, so there is limited opportunity for child-level memoization until the bigger bundle split is addressed. Sources: https://vuejs.org/guide/best-practices/performance.html
- The current build generates per-route HTML files via [`apps/vue/scripts/generate-pages.mjs`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/vue/scripts/generate-pages.mjs), which already gives this app a static-content advantage. The main remaining speed issue is shipped and hydrated JS, not HTML generation.

#### Recommendations
- Highest-confidence change: lazy-load route components in [`apps/vue/src/router/index.ts`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/vue/src/router/index.ts).
  - Replace eager imports with route component factories like `() => import('@/views/ChartPage')`.
  - Start with `/chart`, `/media`, and blog detail routes.
- Convert heavy interactive route bodies into async components and use Vue 3.5 lazy hydration strategies where SSR semantics allow it.
  - `hydrateOnVisible()` is a strong candidate for below-the-fold or secondary widgets.
  - `hydrateOnInteraction('click')` is a strong candidate for controls that do not need immediate hydration.
- Split the chart implementation from the route shell.
  - Keep the selector/layout shell server-rendered.
  - Load the chart module only when the route is rendered.
  - Narrow watchers so indicator and candle updates do not do overlapping work.
- Keep the media page data model as-is, but isolate it into its own route chunk so it stops inflating the initial JS path.
- After chunking, consider selective `v-memo` / stable-prop patterns only where profiling shows rerender churn. Do not start with micro-optimizations before fixing the bundle topology.

#### Risks
- Lazy hydration only applies in SSR contexts and changes interaction timing; it can improve load metrics while delaying first usable interaction for those components.
- Aggressive async component splitting may help cold load but slightly hurt first route-open time for `/chart` or `/media` if the benchmark measures that path specifically.
- Overusing `v-memo` or manual render-level micro-optimizations can add complexity without material wins once route chunks are already separated.

#### Gaps
- I did not run a current production bundle analysis for the Vue build, so the exact shared-chunk cost is not quantified here.
- I did not verify whether the benchmark harness requires immediate interactivity on every SSR-rendered page, which affects how far lazy hydration can go.
- The current app uses render-function style components, so some common Vue SFC optimization patterns are less directly applicable.

#### Queries Used
- site:vuejs.org guide best practices performance code splitting
- site:vuejs.org guide components async lazy hydration
- site:router.vuejs.org lazy loading routes
- Vue 3.5 lazy hydration performance official

#### Sources
- https://vuejs.org/guide/best-practices/performance.html
- https://vuejs.org/guide/components/async.html
- https://router.vuejs.org/guide/advanced/lazy-loading.html
