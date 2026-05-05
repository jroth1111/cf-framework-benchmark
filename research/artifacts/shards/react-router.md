### react-router

#### Findings
- The app is already on current framework-mode primitives for Workers: `react-router@7.10.0`, `react@19.1.1`, SSR enabled, and `renderToReadableStream` in [`apps/react-router/app/entry.server.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/react-router/app/entry.server.tsx). That is the right baseline for Cloudflare Workers because React’s Web Streams SSR API is the recommended edge path, and React Router’s Suspense guide layers directly on top of it. Sources: https://react.dev/reference/react-dom/server/renderToReadableStream, https://reactrouter.com/how-to/suspense
- React Router framework mode already gives automatic route-based code splitting, and server-only route exports such as `loader` are removed from client bundles. For this repo, the static data loaders in [`apps/react-router/app/routes/stays.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/react-router/app/routes/stays.tsx), [`apps/react-router/app/routes/stay-detail.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/react-router/app/routes/stay-detail.tsx), and [`apps/react-router/app/routes/blog-post.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/react-router/app/routes/blog-post.tsx) are already on the cheaper side for client JS. Sources: https://reactrouter.com/explanation/code-splitting, https://reactrouter.com/start/framework/data-loading
- Lazy Route Discovery is enabled by default and only ships manifest data for routes needed by the initial SSR, then patches additional route metadata through `/__manifest` as users navigate. In this repo’s small 7-route graph ([`apps/react-router/app/routes.ts`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/react-router/app/routes.ts)), the initial-memory win is real but probably modest; the bigger win is avoiding a full manifest upfront while letting rendered links eagerly discover likely next routes. Sources: https://reactrouter.com/explanation/lazy-route-discovery, https://reactrouter.com/api/components/NavLink/
- The root nav currently renders plain `<Link>`s with no `prefetch` tuning in [`apps/react-router/app/root.tsx`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/react-router/app/root.tsx). React Router supports `prefetch="intent" | "render" | "viewport"` and `discover="none"`; this is one of the most directly supported knobs for navigation speed versus background network/memory tradeoff. Source: https://reactrouter.com/api/components/NavLink/
- In framework mode with SSR, loaders are automatically revalidated after navigations and submissions unless a route defines `shouldRevalidate`. Because this app’s data comes from local static helpers in [`apps/react-router/app/lib/data.ts`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/react-router/app/lib/data.ts), default revalidation likely does unnecessary Worker work on client navigations. Source: https://reactrouter.com/start/framework/route-module
- `clientLoader.hydrate = true` is not a free optimization. It adds client work during hydration and should be reserved for browser-only data needs, ideally with `HydrateFallback`. React also warns hydration mismatches should be treated as bugs because validating/repairing them broadly would be too expensive. For benchmark routes, avoid hydrated client loaders unless the route truly depends on client-only state. Sources: https://reactrouter.com/how-to/client-data, https://react.dev/reference/react-dom/client/hydrateRoot
- React Router 7.10 stabilized `future.v8_splitRouteModules`, which splits client-side route exports (`clientLoader`, `clientAction`, `HydrateFallback`, etc.) into separate chunks. This repo does not currently enable it in [`apps/react-router/react-router.config.ts`](/Users/gwizz/CascadeProjects/cf-framework-benchmark/apps/react-router/react-router.config.ts). Source: https://reactrouter.com/upgrading/future and changelog https://reactrouter.com/start/start/changelog
- For Cloudflare specifically, Worker CPU and memory remain bounded per isolate, so reducing unnecessary SSR/revalidation and avoiding buffered work matters. Static or pre-rendered paths also remove runtime Worker CPU for those requests entirely. Sources: https://developers.cloudflare.com/workers/platform/limits/, https://reactrouter.com/how-to/pre-rendering

#### Recommendations
- Highest-confidence change: add `shouldRevalidate` to static loader routes (`stays`, `stay-detail`, `blog`, `blog-post`, likely `media`) and return `false` unless URL/search params that actually affect data changed. This cuts unnecessary server fetch/revalidation on client navigations.
- Keep static/content routes on server `loader`, not `clientLoader`. In this app, server loaders are cheaper for client CPU because loader code is stripped from browser bundles.
- Enable `future.v8_splitRouteModules` in `react-router.config.ts`. It is stable as of React Router 7.10 and is the most current supported route-module splitting optimization.
- Use selective link warming instead of blanket prefetch. Apply `prefetch="intent"` to high-probability navigations from home/cards/header, and use `discover="none"` only for low-probability or below-the-fold links. Do not use `prefetch="render"` broadly in benchmark pages.
- Keep lazy route discovery enabled. With this route count, do not switch to `routeDiscovery: { mode: "initial" }`; that would trade a small manifest for unnecessary upfront metadata.
- If benchmark rules allow static output, pre-render the truly static routes and payloads (`/`, `/blog`, `/blog/:slug`, `/stays`, `/stays/:id`) while leaving interactive routes (`/chart`, possibly `/media`) on runtime SSR/client data. This is likely the largest page-speed win, but it changes the runtime profile.
- If async data is introduced later, stream only non-critical regions with Suspense and keep the shell outside Suspense. Current streaming setup is correct; the missing optimization is route-level deferral, not server plumbing.

#### Risks
- `prefetch="render"` or overly aggressive eager discovery can inflate background requests, memory, and benchmark noise.
- `shouldRevalidate = false` will serve stale data if these routes later stop being static.
- Pre-rendering can materially improve results but may make the React Router shard less comparable to fully runtime-SSR entries in the benchmark matrix.
- `clientLoader.hydrate` can worsen TTI/hydration cost and introduce mismatch bugs if server/client data diverge.
- `v8_splitRouteModules` is stable, but the benefit may be small until the app introduces client route exports or heavier client-only route code.

#### Gaps
- No bundle report yet for `apps/react-router`, so it is not confirmed whether `@cf-bench/chart-core` is isolated to the `/chart` chunk or leaking into shared chunks.
- No production trace for `/__manifest` or `.data` requests on Workers, so discovery/prefetch overhead is not yet quantified.
- Benchmark policy is unclear on whether pre-rendered/static routes are allowed for this matrix entry.
- No RUM or lab measurement yet for hydration cost on `/chart` and `/media`, which are the most likely client-CPU hotspots.

#### Queries Used
- React Router 7 performance optimization framework mode latest
- React Router 7 Cloudflare Workers SSR performance latest
- React Router lazy route discovery code splitting latest
- site:reactrouter.com performance react router latest
- React Router 7 pitfalls performance memory hydration
- React Router 7 streaming SSR performance latest
- site:reactrouter.com clientLoader hydrate true react router
- site:reactrouter.com shouldRevalidate route module react router framework latest
- site:developers.cloudflare.com workers react router cloudflare latest

#### Sources
- https://reactrouter.com/explanation/code-splitting
- https://reactrouter.com/explanation/lazy-route-discovery
- https://reactrouter.com/how-to/client-data
- https://reactrouter.com/how-to/suspense
- https://reactrouter.com/api/components/NavLink/
- https://reactrouter.com/start/framework/data-loading
- https://reactrouter.com/start/framework/route-module
- https://reactrouter.com/upgrading/future
- https://reactrouter.com/start/start/changelog
- https://reactrouter.com/how-to/pre-rendering
- https://react.dev/reference/react-dom/client/hydrateRoot
- https://react.dev/reference/react-dom/server/renderToReadableStream
- https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/
- https://developers.cloudflare.com/workers/platform/limits/
