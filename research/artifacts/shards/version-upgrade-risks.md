# version-upgrade-risks

#### Findings

- **[version-upgrade-risks-F01]** Next 16.2.4 on Cloudflare should be treated as supported through `@opennextjs/cloudflare`, but only on the Node.js runtime path, with `nodejs_compat` and a compatibility date >= `2024-09-23`; Next Edge Runtime remains unsupported. - Claim type: capability - Confidence: HIGH - [OpenNext Cloudflare overview](https://opennext.js.org/cloudflare) + [OpenNext get started](https://opennext.js.org/cloudflare/get-started) + [Cloudflare compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/) - As-of: OpenNext docs crawled Apr/May 2026
  - Evidence basis: primary adapter docs + primary Cloudflare docs
  - Source family: OpenNext / Cloudflare Workers
  - Applicability: `apps/next` using `@opennextjs/cloudflare@1.19.6`, `next@16.2.4`, Workers
  - Methodology or limitations: local config inspection only; no deploy/build evidence in this shard
  - Counterevidence or caveat: OpenNext lists Node Middleware introduced in Next 15.2 as "not yet supported"; image optimization and caching have adapter-specific behavior.
  - Why it matters: benchmark trust requires verifying the OpenNext-transformed Worker output, not only `next build`.

- **[version-upgrade-risks-F02]** `nodejs_compat` is now a benchmark variable, not just a compatibility checkbox: with dates >= `2024-09-23`, it enables v2 polyfills/globals and can increase bundle size; `nodejs_als` can enable only AsyncLocalStorage. - Claim type: benchmark - Confidence: HIGH - [Cloudflare compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/) + [AsyncLocalStorage docs](https://developers.cloudflare.com/workers/runtime-apis/nodejs/asynclocalstorage/) - As-of: Cloudflare docs current in 2026
  - Evidence basis: primary spec
  - Source family: Cloudflare Workers
  - Applicability: all Worker apps with `nodejs_compat`; locally observed Next, Nuxt, Qwik, Svelte/Solid/Nitro-style apps use it
  - Methodology or limitations: no bundle-size diff measured
  - Counterevidence or caveat: many framework adapters require `nodejs_compat`; removing it may break valid dependencies.
  - Why it matters: upgraded benchmark results can shift from runtime/polyfill cost rather than framework cost.

- **[version-upgrade-risks-F03]** Astro 6.2.2 / `@astrojs/cloudflare@13.3.1` changed Cloudflare assumptions: Node `22.12.0+`, Vite 7+, Content Layer migration, prerendering in `workerd` by default, no Cloudflare Pages support, and `imageService` default changed to `cloudflare-binding`. - Claim type: capability / dx - Confidence: HIGH - [Astro 6.0 release](https://astro.build/blog/astro-6/) + [Astro v6 upgrade guide](https://docs.astro.build/de/guides/upgrade-to/v6/) + [@astrojs/cloudflare docs](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) - As-of: Astro 6 / adapter v13.3.1 docs
  - Evidence basis: primary release/docs
  - Source family: Astro
  - Applicability: `apps/astro` with `imageService: "compile"` and Worker entrypoint
  - Methodology or limitations: German localized upgrade page was opened because search surfaced it; content is official Astro docs.
  - Counterevidence or caveat: local app explicitly pins `imageService: "compile"`, so default-change risk is avoided but should be documented as intentional.
  - Why it matters: Astro 6 can pass local builds while silently changing prerender/runtime parity and image behavior.

- **[version-upgrade-risks-F04]** `@vitejs/plugin-react@6.0.1` removed Babel-related features and requires Vite 8; React Compiler now needs `@rolldown/plugin-babel` plus `reactCompilerPreset()` instead of `react({ babel: ... })`. - Claim type: dx / compatibility - Confidence: HIGH - [vitejs/vite-plugin-react releases](https://github.com/vitejs/vite-plugin-react/releases) - As-of: `plugin-react@6.0.0`
  - Evidence basis: primary release notes
  - Source family: Vite plugin React
  - Applicability: Vite 8.0.10 apps using `@vitejs/plugin-react@6.0.1`; local `pnpm-lock.yaml` includes `@rolldown/plugin-babel`
  - Methodology or limitations: no per-app build log inspected
  - Counterevidence or caveat: apps with no custom Babel or React Compiler config likely need no code change.
  - Why it matters: React benchmarks using compiler/Babel transforms are no longer comparable unless the new transform path is explicit.

- **[version-upgrade-risks-F05]** Vue Router 5.0.6 is low Cloudflare risk for existing Vue Router 4-style apps: official migration docs say no breaking changes unless migrating from `unplugin-vue-router`; v5 is mainly a transition release before v6 removes deprecated APIs and becomes ESM-only. - Claim type: compatibility - Confidence: HIGH - [Vue Router v5 migration guide](https://router.vuejs.org/guide/migration/v4-to-v5.html) - As-of: Vue Router 5 docs
  - Evidence basis: primary docs
  - Source family: Vue Router
  - Applicability: local Vue apps appear to use programmatic routes, not `unplugin-vue-router`
  - Methodology or limitations: no full source audit beyond targeted `rg`
  - Counterevidence or caveat: IIFE build/devtools packaging changed; likely irrelevant for Vite Worker builds.
  - Why it matters: this upgrade probably does not require Cloudflare-specific changes, only route regression tests.

- **[version-upgrade-risks-F06]** RedwoodSDK `rwsdk@1.2.5` is Cloudflare-first but evidence for exact 1.2.5 migration risks is weak; docs emphasize Vite plugin integration, Cloudflare Workers/Miniflare parity, Worker-context testing, and careful `resolve.conditions` handling. - Claim type: reliability / dx - Confidence: MEDIUM - [RedwoodSDK homepage](https://rwsdk.com/) + [RedwoodSDK Vitest guide](https://docs.rwsdk.com/guides/vitest/) + [RedwoodSDK troubleshooting](https://docs.rwsdk.com/guides/troubleshooting/) - As-of: docs crawled Apr/May 2026
  - Evidence basis: primary docs, weak release-note coverage
  - Source family: RedwoodSDK
  - Applicability: `apps/redwood` using `rwsdk@1.2.5`
  - Methodology or limitations: public exact-version changelog was not found in search results
  - Counterevidence or caveat: Cloudflare-first design reduces generic Workers risk, but RSC/resolve-condition mistakes can still build incorrectly.
  - Why it matters: benchmark validation should include Worker-runtime route tests, not just Vite build success.

- **[version-upgrade-risks-F07]** Waku `1.0.0-alpha.9` should remain caveated/experimental for benchmark trust: Waku's own docs ask users to try it on non-production projects, require Node `^24.0.0 || ^22.12.0 || ^20.19.0`, and Cloudflare docs say Waku deploys to Workers with `nodejs_compat` and Workers Assets. - Claim type: reliability - Confidence: HIGH - [Waku docs](https://waku.gg/) + [Cloudflare Waku guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/waku/) - As-of: Waku docs crawled May 2026; Cloudflare guide Feb 23, 2026
  - Evidence basis: primary framework docs + primary Cloudflare docs
  - Source family: Waku / Cloudflare Workers
  - Applicability: `apps/waku` using alpha.9
  - Methodology or limitations: no exact alpha.9 release notes found in primary docs
  - Counterevidence or caveat: Cloudflare has a dedicated Waku guide, so "experimental" is about Waku maturity, not absence of Cloudflare support.
  - Why it matters: Waku results should be labeled alpha and verified with deployed dynamic/RSC routes.

- **[version-upgrade-risks-F08]** Qwik `@qwik.dev/*@2.0.0-beta.34` carries beta/migration risk: public evidence shows the package scope changed to `@qwik.dev/*`, v2 beta has serialization/router fixes, while official Qwik docs still contain many `@builder.io/*` examples and Cloudflare Pages adapter docs. - Claim type: compatibility / dx - Confidence: MEDIUM - [Qwik Cloudflare Pages adapter docs](https://qwik.dev/docs/deployments/cloudflare-pages/) + [Qwik beta.34 release mirror](https://newreleases.io/project/github/QwikDev/qwik/release/%40qwik.dev%2Fcore%402.0.0-beta.34) + [Qwik deployment docs](https://qwik.dev/docs/deployments/) - As-of: beta.34
  - Evidence basis: primary docs + GitHub release mirror
  - Source family: Qwik
  - Applicability: `apps/qwik` using `@qwik.dev/core`, `@qwik.dev/router`, Cloudflare Pages middleware/adapter
  - Methodology or limitations: direct GitHub release page was not retrieved; release evidence is via mirror
  - Counterevidence or caveat: local imports already use `@qwik.dev/*`, so package-scope migration may already be handled.
  - Why it matters: beta router/serialization behavior can affect SSR output and benchmark comparability.

- **[version-upgrade-risks-F09]** Nuxt 4.4.4 on Workers should be validated around Nitro `cloudflare_module`, Workers Static Assets, `nodejs_compat`, and `routeRules`; Nitro docs require compatibility date >= `2024-09-19` for Workers Static Assets and show `nodeCompat: true`. - Claim type: capability / benchmark - Confidence: HIGH - [Cloudflare Nuxt guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/nuxt/) + [Nitro Cloudflare provider](https://www.nitro.build/deploy/providers/cloudflare) + [Nuxt server docs](https://nuxt.com/docs/4.x/getting-started/server) - As-of: Cloudflare guide Feb 23, 2026; Nitro docs current
  - Evidence basis: primary docs
  - Source family: Nuxt / Nitro / Cloudflare Workers
  - Applicability: `apps/nuxt` with `nitro.preset: "cloudflare_module"` and `routeRules`
  - Methodology or limitations: no deployed Nuxt Worker tested
  - Counterevidence or caveat: Cloudflare guide is high-level; many historical Nuxt/Cloudflare failures are dependency-specific.
  - Why it matters: route-level prerender/cache settings can make benchmark routes measure different rendering modes.

#### Local Recommendation Inputs

- Add targeted "trust gates" per upgraded app: Worker build, Wrangler dry-run or preview, one live/preview request for `/`, list route, detail route, and any dynamic/RSC/server-action route.
- Record `nodejs_compat` usage per app in benchmark metadata; where not adapter-required, run an A/B bundle-size/runtime check before keeping it.
- For Astro, document why `imageService: "compile"` is intentional, and verify prerendered pages under default `workerd` behavior.
- For Next, verify no `export const runtime = "edge"` and no Node Middleware benchmark path is being counted as supported.
- For Waku and Qwik, mark results caveated/experimental unless runtime probes pass on the Worker target.
- For Vue Router 5, a normal route regression test is sufficient; no Cloudflare-specific migration change is indicated by primary docs.

#### Gaps

- I did not find primary exact-version migration notes for `rwsdk@1.2.5`.
- I did not retrieve a direct GitHub release page for `@qwik.dev/core@2.0.0-beta.34`; the release details came from a GitHub-release mirror.
- Waku alpha.9 exact release notes were not found in primary docs; Cloudflare/Waku compatibility evidence is mostly guide-level.
- No build artifacts, deployed Workers, or benchmark traces were inspected, so all local recommendations remain research inputs, not final verification.

#### Queries Used

- `Next.js 16 Cloudflare OpenNext adapter compatibility nodejs_compat AsyncLocalStorage middleware supported features`
- `Astro 6 @astrojs/cloudflare Node.js 22 content collections config migration Cloudflare adapter`
- `@vitejs/plugin-react 6 Babel removed React Compiler @rolldown/plugin-babel migration Vite 8 Cloudflare`
- `vue-router 5 migration guide Vue Router 4 to 5 Cloudflare Workers`
- `rwsdk 1.2.5 Cloudflare Workers release notes Vite plugin`
- `Waku 1.0.0-alpha.9 Cloudflare Workers React Server Components Vite plugin childEnvironments`
- `Qwik 2.0.0-beta.34 Cloudflare Workers adapter migration`
- `Nuxt 4.4.4 Cloudflare Workers Nitro cloudflare_module node compatibility routeRules`
- Additional counter/search variants included package-specific `release notes`, `Vite 8 compatibility`, `Node 22`, and `unsupported features` searches.

#### Sources

- [OpenNext Cloudflare overview](https://opennext.js.org/cloudflare) - Next support matrix and unsupported Node Middleware - current docs - primary - OpenNext
- [OpenNext get started](https://opennext.js.org/cloudflare/get-started) - required Wrangler, flags, Edge Runtime caveat - current docs - primary - OpenNext
- [Cloudflare compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/) - `nodejs_compat`, v2, `nodejs_als` - 2026 docs - primary - Cloudflare
- [Astro 6.0 release](https://astro.build/blog/astro-6/) - Node 22, Vite, Cloudflare runtime dev changes - Mar 10, 2026 - primary - Astro
- [Astro v6 upgrade guide](https://docs.astro.build/de/guides/upgrade-to/v6/) - breaking changes and content collections - current docs - primary - Astro
- [@astrojs/cloudflare docs](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) - v13.3.1 adapter options and Pages removal - current docs - primary - Astro
- [vitejs/vite-plugin-react releases](https://github.com/vitejs/vite-plugin-react/releases) - plugin-react 6 Babel removal and Vite 8 requirement - 2026 release notes - primary - Vite
- [Vue Router v5 migration guide](https://router.vuejs.org/guide/migration/v4-to-v5.html) - no breaking changes for plain Vue Router 4 users - current docs - primary - Vue Router
- [RedwoodSDK docs](https://docs.rwsdk.com/guides/troubleshooting/) - resolve conditions and Worker/RSC caveats - current docs - primary - RedwoodSDK
- [Waku docs](https://waku.gg/) - alpha maturity, Node requirements, Cloudflare deployment - current docs - primary - Waku
- [Cloudflare Waku guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/waku/) - Workers Assets and `nodejs_compat` detection - Feb 23, 2026 - primary - Cloudflare
- [Qwik Cloudflare Pages adapter docs](https://qwik.dev/docs/deployments/cloudflare-pages/) - adapter behavior, routes, SSG/SSR - current docs - primary - Qwik
- [Qwik beta.34 release mirror](https://newreleases.io/project/github/QwikDev/qwik/release/%40qwik.dev%2Fcore%402.0.0-beta.34) - beta.34 patch notes - May 2026 - secondary mirror of primary GitHub - Qwik
- [Cloudflare Nuxt guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/nuxt/) - Nuxt Workers deployment - Feb 23, 2026 - primary - Cloudflare
- [Nitro Cloudflare provider](https://www.nitro.build/deploy/providers/cloudflare) - `cloudflare_module`, Static Assets date, `nodeCompat` - current docs - primary - Nitro
