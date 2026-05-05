# Cloudflare Framework Docs Gap Research Report

> Research date: 2026-05-05 | Mode: Standard | Overall confidence: HIGH for gap identification, MEDIUM for framework-specific runtime conclusions

## Decision Surface

- Post-implementation status: the repo now has Cloudflare config disclosure,
  optimization provenance controls, trace/colo result metadata, and static
  verification gates. Qwik is excluded from canonical runs until its Worker
  output passes v5 live contracts.
- Best current recommendation: keep the upgraded packages, but do not publish or rely on decision-grade benchmark results until all targeted live Worker rows pass the route/API/cache contracts with the recorded Cloudflare provenance.
- Best alternative: defer only Waku/Qwik/Astro public claims and run the rest with current docs, while clearly labeling unverified route/config gaps.
- Do-nothing baseline: run the current benchmark scripts against current targets and accept existing README tiers/configs; this risks mixing asset-first, Worker-first, SSR, prerender, cache, and observability modes without disclosure.
- Recommendation confidence: HIGH for adding the controls because Cloudflare docs directly identify the relevant platform surfaces; MEDIUM for package-specific runtime risk because no builds/deploys were run.
- Fit conditions: live Workers benchmark, current package set, Cloudflare Workers/Workers Assets targets, no intent to re-rank frameworks in this research pass.
- Strongest disconfirming evidence: Cloudflare's asset-first behavior is intentional and often optimal, so broad `run_worker_first` absence/presence is not automatically a bug.
- What would change the answer: successful per-framework Worker build/preview/deploy probes plus an audit proving route invocation/cache/observability modes are already captured in benchmark metadata.

## Evidence-Backed Findings

- **[F01] Asset routing is the highest-priority benchmark-control gap.** Cloudflare Workers Static Assets default to asset-first routing, while `run_worker_first` deliberately routes selected requests through Worker code. This should be recorded and probed per route, not normalized blindly. Sources: [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/), [Configuration and Bindings](https://developers.cloudflare.com/workers/static-assets/binding/), [Worker script routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).

- **[F02] Astro 6 creates a real prerequisite gap.** The repo uses `astro@6.2.2` and `@astrojs/cloudflare@13.3.1`; initial inspection found stale Node 20 prerequisite text, and the README now requires Node.js 22+. Cloudflare's Astro page states Astro 6 requires Node 22+ for Workers Builds. Sources: [Astro Workers guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/), [Astro 6 release](https://astro.build/blog/astro-6/).

- **[F03] Observability needs a benchmark policy.** Current Cloudflare docs and auto-config examples favor observability, but logs/traces have sampling and cost/volume implications. Use it for live trust gates; standardize or disclose it for timing runs. Sources: [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/), [Workers Traces](https://developers.cloudflare.com/workers/observability/traces/).

- **[F04] React Router's Workers framework path is full-stack SSR, not SPA/prerender.** Cloudflare says SPA mode and prerendering are not currently supported with the Cloudflare Vite plugin for React Router; React Router as a client library in React+Vite is a different baseline. Source: [React Router Workers guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/).

- **[F05] OpenNext/Next must be verified on the OpenNext Workers path.** `next dev` does not prove workerd behavior; OpenNext preview/deploy is the relevant target. Node middleware remains unsupported. Sources: [Next.js Workers guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/), [OpenNext Cloudflare docs](https://opennext.js.org/cloudflare).

- **[F06] `nodejs_compat` is both required-by-adapter and benchmark-relevant metadata.** Do not treat it as a universal optimization toggle, but record it because it changes runtime/polyfill assumptions and may affect emitted bundle/startup properties. Sources: [Cloudflare compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/), [OpenNext get started](https://opennext.js.org/cloudflare/get-started), [Nitro Cloudflare provider](https://www.nitro.build/deploy/providers/cloudflare).

- **[F07] Waku/Qwik caveats should be split into Cloudflare support, maturity, and runtime-proof status.** Cloudflare has Workers guides for both, but Waku is alpha and Qwik is beta in this repo; runtime probes should decide whether results are trusted. Qwik is currently blocked because fresh Worker deploys with `@qwik.dev/router@2.0.0-beta.34` returned Q14 task-resolution error pages. Sources: [Waku Workers guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/waku/), [Qwik Workers guide](https://developers.cloudflare.com/workers/frameworks/framework-guides/qwik/), [Waku docs](https://waku.gg/).

- **[F08] Current repo docs understate platform limits and proof needs.** Current Cloudflare limits include CPU, memory, Worker size, startup time, static asset limits, and dry-run/deploy output that can be used as trust gates. Source: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

## Inferences

- The benchmark has a per-app Cloudflare config audit and optimization audit. Keep them in static verification before adding new performance advice.
- `docs/cloudflare-best-practices.md` has been revised to cover the Workers Assets routing model, observability policy, startup/bundle proof, compatibility flags, and framework caveats.
- The README tier model is defensible only if it distinguishes "Cloudflare-supported framework" from "this benchmark implementation mode." Astro and Waku have full-stack Workers guidance, but the repo classifies their current implementations under `framework-prerender`; Qwik is currently blocked despite having a Cloudflare guide.
- Build success alone is insufficient for the upgraded packages. The minimum trust gate is build -> Wrangler dry-run or preview -> route/API/cache probes -> bundle size/startup evidence where available.

## Recommendation

- Recommended action: keep the implemented Cloudflare config/optimization provenance gates in `pnpm verify:static`, keep Qwik excluded until the Q14 runtime failure is resolved, and require live route/API/cache verification before publishing canonical comparisons on the upgraded matrix.
- Why it wins in this context: it keeps the upgraded packages, avoids reverting useful package work, and targets the actual risk: route/runtime/config comparability rather than generic framework advice.
- Key tradeoffs and caveats:
  - Do not force all apps to asset-first or Worker-first. Label the mode.
  - Do not blanket-enable observability for timing runs. Disclose or standardize it.
  - Do not demote Waku/Qwik as "unsupported"; label maturity and runtime proof separately.
  - Do not treat auto-config as authoritative in this monorepo; use it as a drift oracle.

## Open Questions

- Which live targets, if any, are built via Workers Builds rather than local deploy scripts?
- Do Waku alpha.9 and Qwik beta.34 pass deployed route/API/RSC/SSR probes with the current package set?
- Which apps actually invoke the Worker for `/`, `/stays`, `/blog`, `/chart`, `/media`, and `/api/*` after static asset matching?
- Is Smart Placement enabled on any live Worker, and has it reached a stable placement status?
- Does `nodejs_compat` materially affect emitted bundle size/startup for any app where it is not adapter-required?

## Methodology

- Problem frame summary: identify Cloudflare-doc-backed best practices and gaps after framework package upgrades in a Workers benchmark monorepo.
- Shards used: `cloudflare-framework-guides`, `workers-platform-practices`, `version-upgrade-risks`, plus a contrarian pass.
- Search queries and source families: Cloudflare Workers framework guides, Workers Static Assets, Workers Logs/Traces, Workers limits, OpenNext, Astro, Vite plugin React, Vue Router, RedwoodSDK, Waku, Qwik, Nuxt/Nitro.
- Recency policy and staleness horizon: current as of 2026-05-05; prefer 2025-2026 official docs and release notes.
- Limitations: no package installs, builds, deploys, live route checks, or benchmark runs were performed; this is research and gap identification, not runtime verification.

## Appendix: Evidence and Shard Detail

- Problem frame artifact: `./research/artifacts/problem-frame.md`
- Evidence ledger: `./research/artifacts/evidence-ledger.md`
- Cross-reference: `./research/artifacts/cross-reference.md`
- Contrarian pass: `./research/artifacts/contrarian.md`
- Shards:
  - `./research/artifacts/shards/cloudflare-framework-guides.md`
  - `./research/artifacts/shards/workers-platform-practices.md`
  - `./research/artifacts/shards/version-upgrade-risks.md`
