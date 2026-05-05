# Contrarian Analysis

- **Consensus claim or recommendation**: Asset routing is a high-priority benchmark fairness gap.
- **Counterevidence found**: Cloudflare's asset-first default is intentional: it avoids Worker invocation for matching static assets and improves asset delivery. `run_worker_first=true` can increase latency with Smart Placement because all requests go through the Worker first. Sources: [Static Assets](https://developers.cloudflare.com/workers/static-assets/), [Configuration and Bindings](https://developers.cloudflare.com/workers/static-assets/binding/), [Worker script routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).
- **Boundary condition**: Opposite answer is plausible for pure static/SPAs where asset-first is the intended production architecture.
- **Overlooked alternative or no-action path**: Do not normalize configs to Worker-first. Instead classify benchmark modes: asset-first static, selective Worker-first API, full Worker-first SSR/middleware.
- **Recommendation impact**: **Narrow**. Record/probe `run_worker_first`, `not_found_handling`, cache headers, and route behavior, but treat them as workload modes, not universal defects.

- **Consensus claim or recommendation**: Observability should be enabled or standardized/disclosed.
- **Counterevidence found**: Full logging/tracing can add cost and volume pressure; Cloudflare explicitly recommends sampling for high-traffic workloads. Invocation logs can be disabled, and tracing has separate sampling. Sources: [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/), [Traces](https://developers.cloudflare.com/workers/observability/traces/), [Workers Best Practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/).
- **Boundary condition**: For raw performance runs, disabling or uniformly sampling observability may be more fair than enabling everything.
- **Overlooked alternative or no-action path**: Publish observability state per run and use a standard low sample rate for deployed confidence tests.
- **Recommendation impact**: **Split by context**. Enable/disclose for live trust gates; standardize or disable uniformly for latency/bundle benchmark runs.

- **Consensus claim or recommendation**: Astro 6 requires Node 22 for Workers Builds.
- **Counterevidence found**: No significant counterevidence found. Cloudflare's Astro guide says Astro 6 currently requires Node 22+ for Workers Builds. Source: [Astro on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/).
- **Boundary condition**: If the benchmark never uses Workers Builds and only runs local builds with a pinned compatible Node, this is less about Cloudflare deployment and more about repo prerequisites.
- **Overlooked alternative or no-action path**: Pin Node via `.nvmrc`/Volta/asdf and document local-vs-Workers-Builds parity.
- **Recommendation impact**: **Reinforce**.

- **Consensus claim or recommendation**: React Router full-stack Workers path should not be put in SPA/prerender bucket.
- **Counterevidence found**: Cloudflare's Vite plugin supports SPAs generally, and Cloudflare has a React SPA tutorial. But the React Router guide specifically says SPA mode and prerendering are not currently supported with the Cloudflare Vite plugin. Sources: [React Router guide](https://developers.cloudflare.com/workers/frameworks/framework-guides/react-router/), [Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/), [React SPA tutorial](https://developers.cloudflare.com/workers/vite-plugin/tutorial/).
- **Boundary condition**: React Router as a client library inside a React+Vite SPA is a different target and can be SPA-bucketed.
- **Overlooked alternative or no-action path**: Split "React Router full-stack SSR" from "React+Vite SPA using React Router library."
- **Recommendation impact**: **Reinforce with narrower wording**.

- **Consensus claim or recommendation**: Waku/Qwik should remain caveated until runtime probes pass.
- **Counterevidence found**: Cloudflare has Worker guides for both; Waku is in automatic configuration; Qwik docs present Cloudflare deployment paths. Waku's public ecosystem is alpha-oriented, but Cloudflare's guide itself does not say "do not use." Sources: [Waku guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/waku/), [Qwik guide](https://developers.cloudflare.com/workers/frameworks/framework-guides/qwik/), [Qwik Cloudflare Pages docs](https://qwik.dev/docs/deployments/cloudflare-pages/), [Waku site](https://waku.gg/).
- **Boundary condition**: If the benchmark is only testing "Cloudflare has a deploy recipe," the caveat is weaker. If it claims production maturity or decision-grade framework ranking, the caveat remains strong.
- **Overlooked alternative or no-action path**: Label caveats separately: Cloudflare integration support, framework maturity, runtime probe status.
- **Recommendation impact**: **Split by context**.

- **Consensus claim or recommendation**: `nodejs_compat` is a benchmark variable and should be recorded.
- **Counterevidence found**: It is sometimes not optional. OpenNext says Next apps must enable it. Nitro has a `nodeCompat` Cloudflare option. Cloudflare also notes newer compatibility dates and Wrangler versions can reduce unnecessary injected polyfills, and `nodejs_als` is a narrower alternative for AsyncLocalStorage. Sources: [Compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/), [Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/), [OpenNext get started](https://opennext.js.org/cloudflare/get-started), [Nitro Cloudflare](https://www.nitro.build/deploy/providers/cloudflare).
- **Boundary condition**: For frameworks that require Node APIs, toggling it off is not a fair alternative.
- **Overlooked alternative or no-action path**: Record `compatibility_date`, `nodejs_compat`, `nodejs_compat_v2`/`no_nodejs_compat_v2`, and narrower `nodejs_als` cases.
- **Recommendation impact**: **Narrow**. Record it as a compatibility/config dimension, not always a tunable optimization.

- **Consensus claim or recommendation**: Auto-config shapes are useful drift checks, but Qwik/RedwoodSDK absence limits support proof.
- **Counterevidence found**: This is partly stale. Cloudflare's automatic configuration table includes Waku but not Qwik or RedwoodSDK in the captured page; however Cloudflare has separate Qwik and RedwoodSDK framework guides. Automatic config also has monorepo/workspace limits and skips when config already exists. Sources: [Automatic configuration](https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/), [Qwik guide](https://developers.cloudflare.com/workers/frameworks/framework-guides/qwik/), [RedwoodSDK guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/redwoodsdk/).
- **Boundary condition**: Auto-config is strongest for single-framework, no-existing-Wrangler projects.
- **Overlooked alternative or no-action path**: Use `wrangler setup --dry-run` as a drift oracle, not as proof of runtime correctness.
- **Recommendation impact**: **Narrow/update**. Do not say Qwik is undocumented; say auto-config coverage is incomplete and monorepo-sensitive.

## Assumption Decomposition

- **Composite claim**: Asset routing is a high-priority fairness gap for all Workers Assets apps.
  - Sub-claim A: Workers Assets default to asset-first routing when a path matches an asset. Confidence: **HIGH** - [Static Assets](https://developers.cloudflare.com/workers/static-assets/)
  - Sub-claim B: `run_worker_first` materially changes invocation, billing, latency, and middleware behavior. Confidence: **HIGH** - [Configuration and Bindings](https://developers.cloudflare.com/workers/static-assets/binding/)
  - Sub-claim C: This is equally high-priority for all apps. Confidence: **MEDIUM/LOW** - pure static/SPAs may be correctly asset-first.
  - Revised composite confidence: **HIGH for disclosure/probing; MEDIUM for universal "gap" framing**.

- **Composite claim**: Keep upgraded packages but add docs/config/trust gates before decision-grade results.
  - Sub-claim A: Version/runtime prerequisites changed enough to document, especially Astro 6 Node 22. Confidence: **HIGH** - [Astro on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/)
  - Sub-claim B: Wrangler config drift matters because auto-config has generated shapes but limited monorepo/existing-config behavior. Confidence: **HIGH** - [Automatic configuration](https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/)
  - Sub-claim C: Runtime probes are necessary for Waku/Qwik caveats. Confidence: **MEDIUM/HIGH** - docs show deploy paths, but framework maturity/runtime correctness still needs local proof.
  - Revised composite confidence: **HIGH**, with Waku/Qwik caveat split into Cloudflare-support vs maturity/probe status.

## Sources

- [Cloudflare Static Assets](https://developers.cloudflare.com/workers/static-assets/) - asset routing, cache behavior, `not_found_handling` - last updated Feb 19, 2026.
- [Cloudflare Static Assets: Configuration and Bindings](https://developers.cloudflare.com/workers/static-assets/binding/) - `run_worker_first`, Smart Placement tradeoff - last updated Mar 16, 2026.
- [Cloudflare Static Assets: SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/) - SPA fallback and navigation behavior - last updated 2026.
- [Cloudflare Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) - observability config, sampling, pricing - last updated Feb 6, 2026.
- [Cloudflare Workers Traces](https://developers.cloudflare.com/workers/observability/traces/) - tracing, sampling, overhead note - last updated Feb 6, 2026.
- [Cloudflare Astro guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/) - Astro 6 Node 22 Workers Builds requirement - last updated Feb 23, 2026.
- [Cloudflare React Router guide](https://developers.cloudflare.com/workers/frameworks/framework-guides/react-router/) - SPA/prerender limitation with Cloudflare Vite plugin.
- [Cloudflare Automatic Configuration](https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/) - supported frameworks, dry-run, monorepo/config limits - last updated Mar 20, 2026.
- [Cloudflare Compatibility Flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/) - `nodejs_compat` and bundle-size caveat.
- [OpenNext Cloudflare Get Started](https://opennext.js.org/cloudflare/get-started) - Next/OpenNext requires `nodejs_compat`.
- [Nitro Cloudflare](https://www.nitro.build/deploy/providers/cloudflare) - Nuxt/Nitro Cloudflare preset and `nodeCompat`.
- [Cloudflare Waku guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/waku/) - Waku Workers deploy and generated config - last updated Feb 23, 2026.
- [Cloudflare Qwik guide](https://developers.cloudflare.com/workers/frameworks/framework-guides/qwik/) - Qwik Workers deploy guide - last updated Aug 20, 2025.
- [Cloudflare RedwoodSDK guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/redwoodsdk/) - RedwoodSDK Workers guide - last updated Jan 20, 2026.
