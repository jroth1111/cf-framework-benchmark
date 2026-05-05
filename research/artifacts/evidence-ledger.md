# Evidence Ledger

Research date: 2026-05-05

## E01 - Workers Static Assets And Routing Are Benchmark-Control Surfaces

- Claim type: benchmark / best-practice
- Evidence basis: Cloudflare primary docs; local config inspection
- Source family: Cloudflare Workers docs
- Confidence: HIGH for "must record/probe"; MEDIUM for "universal gap"
- Sources:
  - [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
  - [Static Assets: Configuration and Bindings](https://developers.cloudflare.com/workers/static-assets/binding/)
  - [Worker script routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
- Local applicability:
  - `apps/react/wrangler.toml`, `apps/vue/wrangler.jsonc`, `apps/waku/wrangler.jsonc`, and several baselines use explicit `run_worker_first`.
  - Several framework apps use default asset-first behavior or generated adapter outputs.
- Why it matters:
  - A Workers benchmark can accidentally compare asset-first static delivery against full Worker SSR/middleware unless each benchmarked route records whether the Worker was invoked.
- Limitation:
  - Public docs do not quantify the latency overhead for this repo's exact routes.

## E02 - Astro 6 Introduces A Node 22 Prerequisite Gap

- Claim type: compatibility / dx
- Evidence basis: Cloudflare primary docs; local README/package inspection
- Source family: Cloudflare Workers docs; Astro docs
- Confidence: HIGH
- Sources:
  - [Astro Workers guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/)
  - [Astro 6 release](https://astro.build/blog/astro-6/)
  - [Astro Cloudflare adapter docs](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- Local applicability:
  - `apps/astro/package.json` uses `astro@6.2.2` and `@astrojs/cloudflare@13.3.1`.
  - Initial inspection found stale `Node.js 20+` prerequisite text; `README.md` now says `Node.js 22+`.
- Why it matters:
  - Workers Builds or CI using Node 20 can fail or diverge from local expectations after the Astro upgrade.
- Limitation:
  - This research did not run a build under Node 20 or Node 22.

## E03 - Observability Needs A Benchmark Policy, Not A Blanket Setting

- Claim type: observability / benchmark
- Evidence basis: Cloudflare primary docs; local config inspection
- Source family: Cloudflare Workers docs
- Confidence: HIGH
- Sources:
  - [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
  - [Workers Traces](https://developers.cloudflare.com/workers/observability/traces/)
  - [Workers Best Practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- Local applicability:
  - Some configs include `observability.enabled`, while others do not.
  - Framework auto-config examples commonly include observability.
- Why it matters:
  - Live trust gates need diagnostic visibility; timing benchmarks need uniform disclosure or sampling to avoid hidden run-to-run differences.
- Limitation:
  - No measured overhead was collected.

## E04 - React Router's Cloudflare Full-Stack Path Is Not SPA Or Prerender

- Claim type: capability / benchmark tiering
- Evidence basis: Cloudflare primary docs
- Source family: Cloudflare Workers docs
- Confidence: HIGH
- Sources:
  - [React Router Workers guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/)
  - [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
  - [React SPA with API tutorial](https://developers.cloudflare.com/workers/vite-plugin/tutorial/)
- Local applicability:
  - `apps/react-router` should remain a full-stack/runtime SSR entry if it uses the Cloudflare Vite plugin framework path.
  - React+Vite SPA using React Router as a library belongs in a different baseline bucket.
- Why it matters:
  - A React Router result can be misread if compared against SPA/prerender entries without a route-mode label.
- Limitation:
  - This research did not inspect every route module for final render mode.

## E05 - Next/OpenNext Requires Workerd-Path Verification

- Claim type: capability / verification
- Evidence basis: Cloudflare primary docs; OpenNext primary docs; local config inspection
- Source family: Cloudflare Workers docs; OpenNext docs
- Confidence: HIGH
- Sources:
  - [Next.js Workers guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
  - [OpenNext Cloudflare docs](https://opennext.js.org/cloudflare)
  - [OpenNext Cloudflare get started](https://opennext.js.org/cloudflare/get-started)
- Local applicability:
  - `apps/next/package.json` uses `opennextjs-cloudflare build`, `preview`, and `deploy`.
  - `apps/next/wrangler.toml` has `nodejs_compat` and `nodejs_als`.
- Why it matters:
  - `next dev` is not enough evidence for Workers behavior; OpenNext preview/deploy output is the target path.
- Limitation:
  - No OpenNext build or preview was run in this research task.

## E06 - nodejs_compat Must Be Recorded As A Config Dimension

- Claim type: benchmark / compatibility
- Evidence basis: Cloudflare primary docs; adapter docs
- Source family: Cloudflare Workers docs; OpenNext; Nitro
- Confidence: HIGH
- Sources:
  - [Cloudflare compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/)
  - [Cloudflare Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
  - [OpenNext Cloudflare get started](https://opennext.js.org/cloudflare/get-started)
  - [Nitro Cloudflare provider](https://www.nitro.build/deploy/providers/cloudflare)
- Local applicability:
  - Multiple apps use `nodejs_compat`; Waku also uses `nodejs_als`; Next uses `global_fetch_strictly_public`.
- Why it matters:
  - The flag can be adapter-required, but it still changes runtime assumptions and may affect bundle/startup characteristics.
- Limitation:
  - No A/B bundle or startup measurement was performed.

## E07 - Waku And Qwik Need Separate Caveat Types

- Claim type: reliability / tiering
- Evidence basis: Cloudflare primary docs; framework docs; one secondary release mirror for exact Qwik beta.34
- Source family: Cloudflare Workers docs; Waku; Qwik
- Confidence: MEDIUM-HIGH
- Sources:
  - [Waku Workers guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/waku/)
  - [Waku docs](https://waku.gg/)
  - [Qwik Workers guide](https://developers.cloudflare.com/workers/frameworks/framework-guides/qwik/)
  - [Qwik Cloudflare Pages docs](https://qwik.dev/docs/deployments/cloudflare-pages/)
- Local applicability:
  - `apps/waku/package.json` uses `waku@1.0.0-alpha.9`.
  - `apps/qwik/package.json` uses `@qwik.dev/*@2.0.0-beta.34`.
  - Qwik is currently blocked and removed from live canonical targets because fresh Worker deploys returned Q14 task-resolution error pages.
- Why it matters:
  - Cloudflare integration support exists, but framework maturity and current runtime proof are separate claims.
- Limitation:
  - Waku/Qwik exact-version release notes were incomplete or weaker than other packages.

## E08 - Current Repo Docs Are Stale Against Current Cloudflare Guidance

- Claim type: documentation / maintainability
- Evidence basis: local inspection plus current docs
- Source family: local repo; Cloudflare Workers docs
- Confidence: HIGH
- Sources:
  - [Framework guides](https://developers.cloudflare.com/workers/framework-guides/)
  - [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
  - [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- Local applicability:
  - `docs/cloudflare-best-practices.md` omits current guidance on Workers Assets routing, observability sampling, startup/bundle proof, and several framework-specific caveats.
  - `docs/cloudflare-limits.md` is too imprecise for current CPU, memory, size, and startup limits.
- Why it matters:
  - The benchmark can be correctly implemented but still interpreted incorrectly if the current docs do not name these controls.
- Limitation:
  - This research did not edit those docs; it only identifies gaps.
