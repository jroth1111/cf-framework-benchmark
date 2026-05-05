### react

#### Findings
- Local repo evidence: `apps/react` is a hydrated SPA using `hydrateRoot` + `BrowserRouter`, with all route components imported eagerly in [`apps/react/src/App.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/react/src/App.tsx) and prerendered HTML generated via `renderToString` in [`apps/react/scripts/generate-pages.mjs`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/react/scripts/generate-pages.mjs). A local production build emitted `main` at `205.66 kB` (`65.37 kB` gzip) plus `vendor` at `46.03 kB` (`16.34 kB` gzip), so initial-route overfetch is currently the main benchmark issue.
- The highest-confidence optimization is route-level code splitting. React's official `lazy()` API defers loading component code until first render, and React Router documents that framework/data-mode routing can split by route automatically instead of bundling "all routes into a single giant build." https://react.dev/reference/react/lazy https://reactrouter.com/explanation/code-splitting
- React Router's current performance features go further than plain `React.lazy`: `createBrowserRouter`/data-framework mode supports `route.lazy`, and lazy route discovery reduces both initial bundle size and client memory by loading route metadata progressively. React Router explicitly says lazy discovery improves initial load and reduces memory usage. https://reactrouter.com/api/data-routers/createBrowserRouter/ https://reactrouter.com/explanation/lazy-route-discovery
- For the current declarative `<Routes>` setup, React Router does not give you the full route-module splitting/discovery toolchain. In practice, that means the low-risk path is `React.lazy` + `Suspense`; the higher-payoff path is migrating this app to data/framework mode. https://reactrouter.com/start/modes https://reactrouter.com/explanation/code-splitting
- If code-splitting is introduced, the prerender pipeline should move off `renderToString`. React 19's `prerender` is the supported SSG API, waits for Suspense/lazy work to resolve, and is explicitly recommended over `renderToString` for static generation. https://react.dev/reference/react-dom/static/prerender https://react.dev/blog/2024/12/05/react-19
- React 19 also makes the strongest CPU/memory optimization possible available: do not hydrate pages that do not need interactivity. `prerender` can omit bootstrap scripts entirely, and `renderToStaticMarkup` produces output that cannot be hydrated. For benchmark pages that are effectively static content, this removes client React CPU and memory almost entirely. https://react.dev/reference/react-dom/static/prerender https://react.dev/reference/react-dom/server/renderToStaticMarkup
- Vite already optimizes async chunks well: it emits `modulepreload`, rewrites dynamic imports to preload common chunks in parallel, and keeps async CSS split and loaded with the chunk. That means route/code splitting is especially benchmark-friendly here because Vite reduces the usual waterfall penalty. https://vite.dev/guide/features.html
- For an evergreen benchmark browser matrix, `build.target: "esnext"` is a valid optimization. Vite documents that `esnext` assumes native dynamic import support and performs only minimal transpiling, which can shave JS size and parse/compile CPU. https://vite.dev/config/build-options.html
- Cloudflare Workers static-assets routing is already favorable in this repo's config: with `assets.not_found_handling = "single-page-application"` and a compatibility date after `2025-04-01`, navigation requests prefer asset serving and do not invoke the Worker script. That means the repo should avoid adding `run_worker_first = true` unless required, because it would defeat this fast path. https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/ https://developers.cloudflare.com/workers/configuration/compatibility-flags/

#### Recommendations
- Priority 1: Convert route components in [`apps/react/src/App.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/react/src/App.tsx) to `React.lazy` + `Suspense`, starting with clearly non-home routes like `Chart`, `Media`, `Blog`, and detail pages. This directly targets the oversized `main` chunk.
- Priority 2: If benchmark rules allow a moderate architecture change, move from declarative `BrowserRouter` to `createBrowserRouter`/RouterProvider and use `route.lazy`. That unlocks React Router's supported route-module splitting and sets up lazy route discovery/prefetch features cleanly.
- Priority 3: Change the SSG script from `renderToString` to React 19 `prerender`. This is the compatible way to keep prerendered HTML working once lazy/Suspense-based splitting is introduced.
- Priority 4: Identify routes that do not need client interactivity and ship them as non-hydrated HTML. Best candidates appear to be blog content pages and possibly static media pages. This is the biggest client CPU/memory win, but only if the benchmark contract allows dropping SPA behavior on those routes.
- Priority 5: For data/framework-mode adoption, use `<Link prefetch="intent">` or `prefetch="viewport"` on likely next-click links to shift module/data cost off the interaction path. https://reactrouter.com/api/components/Link
- Priority 6: If the benchmark only targets modern evergreen browsers, set Vite `build.target` to `"esnext"` and remeasure bundle size plus parse/compile time.

#### Risks
- Migrating to React Router data/framework mode is the best long-term performance path, but it is a larger refactor than simple `React.lazy`.
- Non-hydrated/static routes are only valid if benchmark semantics permit losing client-side React behavior on those pages.
- `build.target: "esnext"` is only safe if the benchmark browser support policy excludes older browsers.
- React Router lazy discovery and prefetch features are beneficial, but they add manifest/prefetch behavior that must be validated against the benchmark harness and caching setup.

#### Gaps
- I did not verify the benchmark harness rules for whether per-route hydration can be removed or whether all routes must remain SPA-interactive.
- I did not measure parse/compile/hydration timings after code splitting in this repo; only current bundle shape was inspected.
- I did not verify whether this benchmark measures only first-load page speed or also in-app navigation speed, which affects the value of Link prefetch/discovery features.

#### Queries Used
- `React 19 performance optimization latest official`
- `React reduce client CPU memory hydration latest`
- `Vite React Cloudflare Workers performance latest`
- `site:react.dev optimizing performance react 19`
- `React 19 pitfalls performance memory hydration`
- `React route-level code splitting performance latest`
- `site:reactrouter.com automatic code splitting react router`
- `site:vite.dev guide/features dynamic import preload`
- `site:developers.cloudflare.com workers static assets single-page-application`

#### Sources
- https://react.dev/reference/react/lazy
- https://react.dev/reference/react-dom/static/prerender
- https://react.dev/reference/react-dom/server/renderToStaticMarkup
- https://react.dev/blog/2024/12/05/react-19
- https://reactrouter.com/explanation/code-splitting
- https://reactrouter.com/explanation/lazy-route-discovery
- https://reactrouter.com/api/data-routers/createBrowserRouter/
- https://reactrouter.com/api/components/Link
- https://reactrouter.com/start/modes
- https://vite.dev/guide/features.html
- https://vite.dev/config/build-options.html
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/
- https://developers.cloudflare.com/workers/configuration/compatibility-flags/
