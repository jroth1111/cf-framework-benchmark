### next

#### Findings
- **[next-F01]** Keeping `"use client"` boundaries as deep as possible reduces client bundle size because once a file is marked `"use client"`, all its imports and children become part of the client bundle; Next recommends placing providers and client boundaries as deep as possible to preserve static optimization. This is directly relevant to this repo because `apps/next/app/chart/ChartClient.tsx` and `apps/next/app/media/MediaClient.tsx` are full-route client islands. — Confidence: HIGH — [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — As-of: Next.js 15 docs
- **[next-F02]** Lazy loading heavy interactive Client Components with `next/dynamic` or `React.lazy` decreases the amount of JavaScript needed to render a route and can lower initial hydration cost on chart/media routes. — Confidence: HIGH — [Lazy Loading](https://nextjs.org/docs/app/guides/lazy-loading) — As-of: Next.js 15 docs
- **[next-F03]** Prefetching is a tradeoff: it can make navigation instant, but it also pulls route JS and RSC data into the client cache earlier; on a benchmark focused on first-load speed and client memory, broad automatic prefetch on heavy links can increase unused data/JS residency. — Confidence: HIGH — [Prefetching](https://nextjs.org/docs/app/guides/prefetching) — As-of: Next.js 15 docs
- **[next-F04]** OpenNext Cloudflare recommends Workers Static Assets incremental cache for pure SSG and R2 incremental cache wrapped with `withRegionalCache(..., "long-lived")` when revalidation is needed, while warning against KV for incremental cache because of eventual consistency. This is adapter-specific guidance that directly affects TTFB and repeat-view latency on Workers. — Confidence: HIGH — [OpenNext Cloudflare Performance](https://opennext.js.org/cloudflare/perf) + [OpenNext Cloudflare Caching](https://opennext.js.org/cloudflare/caching) — As-of: OpenNext Cloudflare docs current as of 2026-03-06
- **[next-F05]** On OpenNext/Cloudflare, `next.config` `headers()` does not apply to immutable static assets such as `/_next/static/*`; the supported approach is a `public/_headers` rule with immutable cache-control, which means config-only static asset header tuning is ineffective for this repo’s Next app. — Confidence: HIGH — [OpenNext Cloudflare Caching](https://opennext.js.org/cloudflare/caching) + [opennextjs-cloudflare issue #624](https://github.com/opennextjs/opennextjs-cloudflare/issues/624) — As-of: current docs and issue thread
- **[next-F06]** Partial Prerendering and Cache Components can improve shell render and first-byte time, but they remain experimental in Next 15.x, so they are lower-confidence benchmark optimizations for a stability-sensitive framework matrix. — Confidence: HIGH — [Partial Prerendering](https://nextjs.org/docs/15/app/getting-started/partial-prerendering) + [Cloudflare Next.js framework guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) + [Next.js 15.4 blog post](https://nextjs.org/blog/next-15-4) — As-of: Next.js 15.4 / Cloudflare docs current
- **[next-F07]** Local preview of streaming or PPR changes can be misleading on Workers because `wrangler dev` / Miniflare has a known buffering issue that can break visible PPR streaming while deployed behavior remains correct. — Confidence: MEDIUM — [cloudflare/workers-sdk issue #8004](https://github.com/cloudflare/workers-sdk/issues/8004) [SINGLE-SOURCE] — As-of: 2025-02 issue state
- **[next-F08]** `next/image` and `next/font` remain relevant on Workers because they reduce transferred bytes, layout shifts, and main-thread work regardless of hosting platform; this repo’s media thumbnails currently use plain `<img>`, so switching them is a concrete route-level optimization. — Confidence: HIGH — [Images](https://nextjs.org/docs/app/getting-started/images) + [Fonts](https://nextjs.org/docs/app/getting-started/fonts) — As-of: Next.js 15 docs
- **[next-F09]** Next’s current package-bundling tooling recommends `@next/bundle-analyzer` and `optimizePackageImports`, which makes shared-chunk analysis and dependency pruning practical for chart/media routes. — Confidence: HIGH — [Package Bundling](https://nextjs.org/docs/app/guides/package-bundling) — As-of: Next.js 15 docs

#### Recommendations
- Move client boundaries deeper and keep the benchmark home page server-rendered except for the minimum hydration marker logic; this is the highest-confidence way to cut client JS and memory.
- Split `ChartClient` and `MediaClient` behind `next/dynamic` with route-local loading UI so heavy chart/media code is not paid on unrelated routes.
- Convert media thumbnails to `next/image` and use `next/font` consistently to reduce bytes and layout work.
- Add `public/_headers` for `/_next/static/*` immutable caching instead of relying on `next.config.mjs` headers, which OpenNext does not apply to static assets.
- Configure OpenNext cache explicitly in `open-next.config.ts`: use static-assets incremental cache for mostly static benchmark pages or R2 regional cache for revalidated content; avoid KV.
- Treat PPR / `cacheComponents` as an experiment branch only after deployed Workers validation rather than as the default benchmark optimization path.

#### Risks
- Disabling or narrowing prefetch may improve first-load CPU/memory while worsening in-app navigation latency benchmarks.
- Dynamic import boundaries can shift cost from initial load to interaction time, so route-entry and post-click measurements both need validation.
- `next/image` on OpenNext adds configuration surface; incorrect image config can add latency instead of removing it.
- R2 regional cache improves read performance but adds bindings and operational complexity.
- PPR and Cache Components are still experimental, so they can reduce stability and comparability in the matrix.

#### Gaps
- No recent primary source quantified client CPU savings from reducing App Router prefetch on heavy-link landing pages.
- OpenNext docs do not provide comparative measurements for static-assets incremental cache versus R2 regional cache on identical Next 15 workloads.
- This shard did not determine whether the repo’s benchmark scoring emphasizes first-load, repeat-view, or mixed navigation scenarios.

#### Queries Used
- `Next.js 15 performance optimization App Router latest`
- `OpenNext Cloudflare performance best practices latest`
- `React 19 Next.js reduce hydration JavaScript latest`
- `site:nextjs.org Next.js performance optimizing latest`
- `Next.js 15 pitfalls performance memory app router`
- `OpenNext Cloudflare Workers cache streaming performance`
- `site:opennext.js.org cloudflare caching incremental cache latest`
- `site:nextjs.org/docs app/guides/prefetching`
- `site:nextjs.org/docs app/guides/lazy-loading`
- `site:nextjs.org/docs app/getting-started/server-and-client-components`

#### Sources
- [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — client boundary rules and bundle implications — current docs — Primary
- [Lazy Loading](https://nextjs.org/docs/app/guides/lazy-loading) — route/client chunk reduction guidance — current docs — Primary
- [Prefetching](https://nextjs.org/docs/app/guides/prefetching) — cache/prefetch tradeoffs — current docs — Primary
- [Images](https://nextjs.org/docs/app/getting-started/images) — image optimization guidance — current docs — Primary
- [Fonts](https://nextjs.org/docs/app/getting-started/fonts) — self-hosted font optimization — current docs — Primary
- [Package Bundling](https://nextjs.org/docs/app/guides/package-bundling) — bundle analysis and import optimization — current docs — Primary
- [Partial Prerendering](https://nextjs.org/docs/15/app/getting-started/partial-prerendering) — experimental status — Next 15 docs — Primary
- [Cloudflare Next.js framework guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) — Workers support and experimental features context — current docs — Primary
- [OpenNext Cloudflare Performance](https://opennext.js.org/cloudflare/perf) — adapter-specific cache guidance — current docs — Primary
- [OpenNext Cloudflare Caching](https://opennext.js.org/cloudflare/caching) — static asset and incremental cache behavior — current docs — Primary
- [opennextjs-cloudflare issue #624](https://github.com/opennextjs/opennextjs-cloudflare/issues/624) — confirms static asset header caveat — 2024 issue — Secondary
- [cloudflare/workers-sdk issue #8004](https://github.com/cloudflare/workers-sdk/issues/8004) — local PPR streaming caveat — 2025 issue — Secondary
