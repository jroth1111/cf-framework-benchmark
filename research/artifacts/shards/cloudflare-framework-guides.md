# cloudflare-framework-guides

#### Findings

- **[cloudflare-framework-guides-F01]** Cloudflare's Workers docs now treat most benchmark entries as Workers-supported full-stack frameworks, including Astro, React Router, Next.js, RedwoodSDK, TanStack Start, Nuxt, Qwik, and Waku. SvelteKit has its own Workers guide/auto-config support but is not listed on the "Full-stack application" static-assets routing page. - Claim type: capability - Confidence: HIGH - [Full-stack application](https://developers.cloudflare.com/workers/static-assets/routing/full-stack-application/) + [Deploy an existing project](https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/) - As-of: Cloudflare docs fetched 2026-05-05; pages last updated Apr 23, 2026
  - Evidence basis: primary spec
  - Source family: Cloudflare Workers docs
  - Applicability: benchmark tiering and support caveats
  - Methodology or limitations: N/A
  - Counterevidence or caveat: Cloudflare's SvelteKit page exists and auto-config supports `@sveltejs/adapter-cloudflare`, but SvelteKit is absent from the full-stack routing page's native list.
  - Why it matters: The benchmark's tier labels should distinguish "official Workers guide exists" from "listed as native full-stack framework."

- **[cloudflare-framework-guides-F02]** Automatic Wrangler configuration supports Next.js, Astro, SvelteKit, Nuxt, React Router, TanStack Start, Vite, Vike, Waku, and static sites; it does not list RedwoodSDK or Qwik in the automatic-configuration table. - Claim type: best-practice - Confidence: HIGH - [Deploy an existing project](https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/) - As-of: Apr 23, 2026
  - Evidence basis: primary spec
  - Source family: Cloudflare Workers docs
  - Applicability: config drift checks after package upgrades
  - Methodology or limitations: N/A
  - Counterevidence or caveat: Qwik and RedwoodSDK still have dedicated Cloudflare framework guide pages, so absence from auto-config is not absence of support.
  - Why it matters: Auto-config can be used as a reference check for many apps, but not as a universal support oracle.

- **[cloudflare-framework-guides-F03]** React Router v7 on Workers is explicitly full-stack SSR via the Cloudflare Vite plugin; Cloudflare says SPA mode and prerendering are "not currently supported" with that plugin. - Claim type: capability - Confidence: HIGH - [React Router Workers guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/) - As-of: Apr 23, 2026
  - Evidence basis: primary spec
  - Source family: Cloudflare Workers docs
  - Applicability: `apps/react-router`, React Router v7, Cloudflare Vite plugin
  - Methodology or limitations: N/A
  - Counterevidence or caveat: SPA use is still supported via the React template with React Router as a library, but that is not the full-stack React Router framework path.
  - Why it matters: React Router should remain in `framework-runtime`; any SPA/prerender comparison needs a caveat or separate React/Vite baseline.

- **[cloudflare-framework-guides-F04]** Next.js on Workers is the OpenNext path; Cloudflare says most Next features are supported, including App Router, Pages Router, RSC, SSG, SSR, ISR, middleware, PPR, and composable caching, but Node.js middleware is not yet supported. - Claim type: capability - Confidence: HIGH - [Next.js Workers guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) + [OpenNext Cloudflare docs](https://opennext.js.org/cloudflare) - As-of: Apr 23, 2026 / current OpenNext docs crawled May 2026
  - Evidence basis: primary spec plus framework adapter docs
  - Source family: Cloudflare Workers docs; OpenNext docs
  - Applicability: `apps/next`, `next@16.2.4`, `@opennextjs/cloudflare`
  - Methodology or limitations: N/A
  - Counterevidence or caveat: Cloudflare notes `next dev` runs in Node.js; preview/integration testing should use `wrangler dev` through OpenNext for workerd parity.
  - Why it matters: The benchmark should test/deploy through OpenNext preview/deploy, not infer Workers behavior from `next dev`.

- **[cloudflare-framework-guides-F05]** Astro has two distinct Workers deployment modes: pure static assets with no Worker `main`, or on-demand rendering through `@astrojs/cloudflare`; the adapter defaults to `output: "server"` and static routes should opt into `prerender = true`. - Claim type: best-practice - Confidence: HIGH - [Astro Workers guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/) - As-of: Apr 23, 2026
  - Evidence basis: primary spec
  - Source family: Cloudflare Workers docs
  - Applicability: `apps/astro`, `astro@6.2.2`, `@astrojs/cloudflare@13.3.1`
  - Methodology or limitations: N/A
  - Counterevidence or caveat: Cloudflare's Astro page says Astro 6 is beta and requires Node.js 22 for Workers Builds; the local README now matches that Node.js 22+ prerequisite.
  - Why it matters: Astro should be documented either as SSR/hybrid via adapter or as static/prerender; current tiering as `framework-prerender` may not match local adapter config.

- **[cloudflare-framework-guides-F06]** Nuxt, SvelteKit, TanStack Start, and Waku all have generated config shapes using Workers Assets plus `nodejs_compat`; Nuxt expects `preset: cloudflare`, SvelteKit expects `@sveltejs/adapter-cloudflare`, TanStack Start uses the Cloudflare Vite plugin, and Waku auto-config points to `dist/worker.js` plus `dist/public`. - Claim type: best-practice - Confidence: HIGH - [Nuxt guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/nuxt/) + [SvelteKit guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit/) + [TanStack Start guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/) + [Waku guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/waku/) - As-of: Apr 23, 2026
  - Evidence basis: primary spec
  - Source family: Cloudflare Workers docs
  - Applicability: corresponding benchmark apps after package upgrades
  - Methodology or limitations: N/A
  - Counterevidence or caveat: Local configs intentionally differ in places, for example Nuxt uses `worker.mjs`, Waku uses `src/worker.ts`, TanStack uses `worker/index.ts`; those need explicit local justification or auto-config parity checks.
  - Why it matters: Mismatched entrypoints can be valid but should be benchmark-controlled and documented.

- **[cloudflare-framework-guides-F07]** React + Vite and Vue Workers guides describe SPA plus Worker API templates using the Cloudflare Vite plugin; `assets.not_found_handling = "single-page-application"` makes SPA routes bypass the Worker, while `run_worker_first` can selectively force Worker handling. - Claim type: best-practice - Confidence: HIGH - [React + Vite guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/) + [Vue guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/vue/) + [Static Assets](https://developers.cloudflare.com/workers/static-assets/) - As-of: Apr 23, 2026
  - Evidence basis: primary spec
  - Source family: Cloudflare Workers docs
  - Applicability: wrapper baselines, not framework-runtime peers
  - Methodology or limitations: N/A
  - Counterevidence or caveat: The local React/Vue configs use custom routing with `not_found_handling = "none"` and broad `run_worker_first`, which is benchmark-control behavior rather than the default Cloudflare SPA optimization.
  - Why it matters: React/Vue baselines should keep separate tiering and document that routing intentionally differs from the official SPA template.

- **[cloudflare-framework-guides-F08]** Cloudflare's Vite plugin is the official local parity path for Vite-based Workers apps: Worker code runs inside workerd, uses the Vite Environment API, supports static sites/SPAs/full-stack apps, and officially supports TanStack Start and React Router v7 SSR. - Claim type: dx - Confidence: HIGH - [Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/) - As-of: Oct 29, 2025
  - Evidence basis: primary spec
  - Source family: Cloudflare Workers docs
  - Applicability: React Router, TanStack Start, React/Vue baselines, RedwoodSDK/Waku where using Cloudflare Vite plugin
  - Methodology or limitations: N/A
  - Counterevidence or caveat: Wrangler remains relevant for remote dev/deploy and non-Vite flows.
  - Why it matters: Apps not using the plugin for dev/build parity should be marked as custom baselines or verified with `wrangler dev`.

- **[cloudflare-framework-guides-F09]** Static-assets routing changed enough to affect benchmark fairness: static files are served without invoking Worker code, SPA fallback can return `index.html`, and with compatibility date `2025-04-01` or newer plus `assets.not_found_handling`, navigation requests may bypass the Worker unless `run_worker_first` is configured. - Claim type: benchmark - Confidence: HIGH - [Static Assets](https://developers.cloudflare.com/workers/static-assets/) + [SSG and custom 404 pages](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/) + [SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/) - As-of: Apr 23, 2026
  - Evidence basis: primary spec
  - Source family: Cloudflare Workers docs
  - Applicability: all apps with `[assets]` / `assets` config
  - Methodology or limitations: N/A
  - Counterevidence or caveat: Worker-first routing is configurable, so this is not a universal behavior; benchmark configs must record which routes invoke Workers.
  - Why it matters: A "Workers benchmark" can accidentally compare asset-serving paths against SSR Worker paths unless route invocation is controlled.

#### Local Recommendation Inputs

- Add a docs/config audit table per app: official guide URL, official adapter/tool, expected `main`, expected assets directory, expected `compatibility_flags`, local `main`, local assets directory, local deviation rationale.
- Revisit README tiers: Astro and Waku have official full-stack Workers guidance; if kept in `framework-prerender`, explain that the benchmark implementation is prerender/static-oriented rather than unsupported.
- Add explicit benchmark controls for "Worker invoked vs asset served" on `/`, `/stays`, `/blog`, `/chart`, `/media`, and `/api/*`.
- Update `docs/cloudflare-best-practices.md`: include Workers Assets routing, `not_found_handling`, `run_worker_first`, React Router no-SPA/no-prerender caveat, Astro 6 Node 22 Workers Builds caveat, OpenNext Node middleware limitation.
- Treat React/Vue as wrapper baselines, not framework-runtime peers, unless reworked to the official Cloudflare Vite plugin SPA+API template shape.
- For upgraded packages, run auto-config comparison where applicable rather than blindly adopting generated files.

#### Gaps

- Cloudflare docs do not give a precise support tier taxonomy matching this repo's `framework-runtime`, `framework-prerender`, `wrapper-baseline`, and `framework-experimental` buckets.
- Public Cloudflare docs do not explain why SvelteKit is supported in framework/auto-config docs but absent from the full-stack static-assets native list.
- Qwik Workers guidance references Qwik Cloudflare Pages binding docs, which weakens Workers-specific confidence for binding details.
- RedwoodSDK has a Cloudflare guide but not auto-config table coverage; official generated config expectations are less explicit than for Next/Astro/Svelte/Nuxt/TanStack/Waku.
- This shard did not verify actual deploy/build success after upgrades; it only maps docs/config guidance and local mismatch risks.

#### Queries Used

- `site:developers.cloudflare.com/workers/framework-guides/web-apps Next.js Astro Nuxt Qwik React Router RedwoodSDK SvelteKit TanStack Waku`
- `site:developers.cloudflare.com/workers/frameworks/framework-guides Next.js OpenNext Astro Nuxt SvelteKit Qwik React Router Cloudflare Workers`
- `site:developers.cloudflare.com/workers/framework-guides/web-apps/redwoodsdk rwsdk Cloudflare Workers`
- `site:developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/waku Waku Workers Assets Cloudflare`
- `site:developers.cloudflare.com/workers/framework-guides/web-apps/react-router Cloudflare Vite plugin SPA prerender unsupported`
- `site:developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start Cloudflare Vite plugin Workers Assets`
- `Cloudflare Workers React Router limitations SPA prerender Cloudflare Vite plugin`
- `Waku Cloudflare Workers unsupported Workers Assets routing issue`
- `OpenNext Cloudflare limitations Next.js Node.js middleware unsupported`
- `TanStack Start Cloudflare Workers limitations Workers Assets prerender`

#### Sources

- [Full-stack application](https://developers.cloudflare.com/workers/static-assets/routing/full-stack-application/) - native full-stack Workers framework list - Apr 23, 2026 - primary - Cloudflare Workers docs
- [Deploy an existing project](https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/) - auto-config support table and generated config behavior - Apr 23, 2026 - primary - Cloudflare Workers docs
- [React Router Workers guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/) - React Router SSR/Vite plugin guidance and SPA/prerender caveat - Apr 23, 2026 - primary - Cloudflare Workers docs
- [Next.js Workers guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/) - OpenNext feature support and generated config - Apr 23, 2026 - primary - Cloudflare Workers docs
- [OpenNext Cloudflare docs](https://opennext.js.org/cloudflare) - adapter runtime/version/limitation corroboration - current crawl May 2026 - framework maintainer primary - OpenNext docs
- [Astro Workers guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/) - static vs SSR adapter guidance - Apr 23, 2026 - primary - Cloudflare Workers docs
- [Nuxt guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/nuxt/) - Workers Assets and Cloudflare preset guidance - Apr 23, 2026 - primary - Cloudflare Workers docs
- [SvelteKit guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit/) - adapter and generated config guidance - Apr 23, 2026 - primary - Cloudflare Workers docs
- [TanStack Start guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/) - Vite plugin, Workers Assets, prerender guidance - Apr 23, 2026 - primary - Cloudflare Workers docs
- [Waku guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/waku/) - Waku Workers Assets generated config guidance - Apr 23, 2026 - primary - Cloudflare Workers docs
- [Qwik guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/qwik/) - Qwik Workers Assets guidance - Apr 23, 2026 - primary - Cloudflare Workers docs
- [React + Vite guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/) - React SPA plus Worker API template guidance - Apr 23, 2026 - primary - Cloudflare Workers docs
- [Vue guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/vue/) - Vue SPA plus Worker API template guidance - Apr 23, 2026 - primary - Cloudflare Workers docs
- [Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/) - workerd local parity and supported Vite framework paths - Oct 29, 2025 - primary - Cloudflare Workers docs
- [Static Assets](https://developers.cloudflare.com/workers/static-assets/) - asset serving, caching, SPA fallback, run_worker_first - Apr 23, 2026 - primary - Cloudflare Workers docs
- [SSG and custom 404 pages](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/) - `404-page`, navigation bypass, compatibility date caveat - Apr 23, 2026 - primary - Cloudflare Workers docs
