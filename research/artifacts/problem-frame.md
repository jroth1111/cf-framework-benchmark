# Cloudflare Framework Best-Practices Gap Analysis Problem Frame

Research date: 2026-05-05

## Literal Question

Search Cloudflare documentation for the combination of frameworks in this benchmark, find current best practices and optimizations, and identify gaps after the package upgrade pass:

- `next` 15.4.10 -> 16.2.4
- `astro` ^5.16.6 -> 6.2.2
- `@astrojs/cloudflare` ^12.6.12 -> 13.3.1
- `@vitejs/plugin-react` 5.x -> 6.0.1, with Babel removed from the plugin
- `vue-router` ^4.6.x -> 5.0.6
- `rwsdk` 1.0.0-beta.55 -> 1.2.5
- `waku` alpha.5 -> alpha.9
- `@qwik.dev/*` beta.16 -> beta.34
- `nuxt` ^4.3.1 -> 4.4.4

## Likely Decision Or Job To Be Done

Decide what documentation, configuration, benchmark controls, and follow-up implementation work are needed so the Cloudflare framework benchmark remains current, fair, and aligned with official Cloudflare guidance.

## Downstream Consumer

Maintainer of `cf-framework-benchmark`, especially someone reviewing version-upgrade consequences before deploying/benchmarking the current app matrix on Workers.

## Stakes And Reversibility

Mode: Standard. The decision affects benchmark fairness and deploy correctness, but changes are local and reversible. Public benchmark results can become misleading if Cloudflare adapter behavior, Workers routing, caching, or runtime limits are misrepresented.

## Non-Negotiables And Constraints

- Prefer official Cloudflare documentation and framework adapter documentation over generic blog advice.
- Preserve benchmark comparability: do not recommend framework-specific optimizations that violate route, cache, selector, or data contracts unless they are reported as bucket-changing caveats.
- Target live Cloudflare Workers, not Pages-only guidance, unless a framework adapter only exposes Pages-style output and the repo adapts it to Workers.
- Treat the current repo state as dirty user work; research artifacts should not overwrite unrelated files.
- Repo tooling guidance says use `pnpm` and track work in `bd`.

## Included Scope

- Cloudflare Workers framework guides and adapter guidance for Next/OpenNext, Astro, Nuxt/Nitro, SvelteKit, Qwik, React Router, RedwoodSDK, Waku, Vite-based baselines, and Hono-style baselines.
- Cross-cutting Workers guidance that affects benchmark validity: assets routing, cache behavior, compatibility dates/flags, Node compatibility, observability, Smart Placement, CPU/startup limits, bundle size, and local/remote verification.
- Gaps between current repo docs/configs and current Cloudflare docs as of 2026-05-05.

## Excluded Scope

- Running live deployments or changing framework implementations.
- Re-ranking frameworks by measured performance.
- Broad non-Cloudflare framework migration advice unless needed to interpret Cloudflare support status.

## Leading Options, Substitutes, And Do-Nothing Baseline

- Option A: Keep the current upgraded package set and add targeted docs/config checks for Cloudflare-specific drift.
- Option B: Adjust specific framework configs where official Cloudflare guidance contradicts current repo patterns.
- Option C: Split experimental or weakly-supported frameworks into explicit caveat buckets until their Cloudflare story is proven.
- Do-nothing baseline: rely on current README and `docs/cloudflare-best-practices.md`, accepting that some guidance may be stale or underspecified.

## What Would Make The Output Actionable

- A prioritized gap list with evidence, affected frameworks/files, and recommended next action.
- Clear distinction between "official Cloudflare guidance", "framework-maintainer guidance", and "inference from repo inspection".
- Explicit unknowns that require live build/deploy verification rather than documentation research.

## Likely Reframe Or Obsolescence Hypothesis

The question may be less "which framework is best" and more "which benchmark entries are still Cloudflare-native and contract-comparable after current adapter/version changes." Some framework guides may now emphasize Cloudflare Vite plugin or OpenNext flows that supersede older Pages-oriented assumptions.
