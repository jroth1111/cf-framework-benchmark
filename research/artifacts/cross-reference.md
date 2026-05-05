# Cross-Reference

## Corroborated Findings

- Cloudflare Workers Static Assets and framework-specific Workers guides are now the right baseline source family for this benchmark. This is corroborated across the framework guide index, individual framework guides, Workers Static Assets docs, and automatic configuration docs.
- Asset routing is a benchmark control surface. Sources agree that default behavior is asset-first, while `run_worker_first` changes which requests invoke Worker code. The contrarian pass narrowed this from "defect" to "mode that must be recorded and probed."
- The upgraded Astro app had a real prerequisite gap during initial inspection: repo docs said Node.js 20+, while current Cloudflare/Astro guidance for Astro 6 points to Node 22+ for Workers Builds. The README now requires Node.js 22+.
- React Router has a narrow Cloudflare-specific caveat: Cloudflare's full-stack React Router path is SSR via Cloudflare Vite plugin, while SPA/prerender mode belongs to React+Vite using React Router as a library.
- `nodejs_compat` is required for some adapters, but should still be recorded as benchmark metadata because it changes runtime/polyfill shape and can affect bundle/startup characteristics.
- Observability is useful for live trust gates, but timing-focused benchmark runs should standardize or disclose sampling state rather than assuming "enabled everywhere" is always more correct.

## Contradictions And Narrowed Claims

- **Asset-first vs Worker-first**: Official SPA/static guidance often prefers asset-first routing because it avoids Worker invocation; full-stack SSR/API routes need Worker handling. The correct recommendation is to classify route modes, not force one routing model.
- **Observability enabled vs raw timing comparability**: Cloudflare docs support Workers Logs and sampling; contrarian evidence says uniform disclosure/sampling is better than blanket full-volume logs for performance runs.
- **Cloudflare support vs framework maturity**: Waku and Qwik have Cloudflare deployment docs, so they are not "unsupported." Their caveat is alpha/beta maturity plus unverified runtime behavior after upgrades.
- **Auto-config as source of truth**: Automatic configuration is useful, but it is not a universal oracle in this monorepo because existing Wrangler configs, custom entrypoints, and missing RedwoodSDK/Qwik auto-config rows limit direct applicability.

## Local Repo Gaps Found By Inspection

- `README.md` now lists `Node.js 22+`, matching the Astro 6 Workers Builds prerequisite.
- `README.md` buckets Astro and Waku under `framework-prerender`, while Cloudflare has full-stack Workers guides for both. That may still be a valid benchmark implementation choice, but it needs an explicit "implementation mode" explanation.
- `docs/cloudflare-best-practices.md` now covers Workers Static Assets routing modes, `run_worker_first`, observability policy, startup/bundle proof, compatibility flags, React Router's no-SPA/no-prerender caveat, and Astro 6's Node 22 caveat.
- Manual Wrangler configs diverge from current auto-config examples in ways that may be intentional; the Cloudflare config/optimization audits now record those differences for review. Examples include custom `main` entrypoints for Nuxt/Waku/TanStack and broad `run_worker_first` in wrapper baselines.
- Static verification now builds the enabled app matrix and runs the Cloudflare config/optimization audits. Live route/cache/deploy trust gates remain open for canonical publication; Qwik is excluded from canonical runs because fresh Worker deploys with `@qwik.dev/router@2.0.0-beta.34` returned Q14 task-resolution error pages.

## Decision-Sensitive Unknowns

- Whether any current live benchmark target is affected by Workers Builds Node version, versus only local builds.
- Whether Waku alpha.9 and Qwik beta.34 pass deployed route/API/RSC/SSR probes with the current package set.
- Whether `nodejs_compat` materially changes bundle size/startup time for frameworks where it is not strictly required.
- Whether any framework-level cache or adapter cache path uses Cache API, Static Assets, framework caches, or CDN fetch caching in a way that should split benchmark buckets.
- Whether Smart Placement is disabled, enabled, or already optimized on live targets. Public docs cannot answer this without account/API/runtime evidence.

## Source-Family Notes

- Highest confidence claims come from Cloudflare Workers docs and framework adapter docs.
- RedwoodSDK exact-version risk remains medium confidence because no primary `rwsdk@1.2.5` release note was found.
- Qwik beta.34 exact-version evidence is weaker because the release detail came through a release mirror, while deployment docs are still primary.
- Public docs are insufficient to rank frameworks after the upgrade; they support gap identification and verification design only.
