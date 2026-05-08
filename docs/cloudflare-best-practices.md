# Cloudflare Deployment And Benchmark Controls

This repo compares framework behavior on Cloudflare Workers. The benchmark must
therefore record the Cloudflare runtime mode for each entry instead of treating
all deployed URLs as equivalent.

## Required Disclosure

Before a result is canonical, the Cloudflare config audit must pass:

```bash
pnpm cloudflare:config-audit --fail-on-gaps
```

The audit records each app's framework guide, adapter, maturity label, Wrangler
entrypoint, assets directory, compatibility date, compatibility flags,
observability setting, and Workers Static Assets routing mode. Cloudflare-support
metadata lives in the `cloudflare` block on each row of `bench/framework-matrix.json`;
live Wrangler settings are read from each app's `wrangler.toml` or `wrangler.jsonc`.

## Workers Static Assets Routing

Workers Static Assets are a benchmark-control surface:

- `asset-first-with-worker-fallback` means static matches can be served before
  Worker code runs.
- `worker-first-for-contract-routes` means benchmark routes are listed in
  `assets.run_worker_first` and should invoke Worker code before asset serving.
- `worker-only` means the Wrangler config has no Static Assets binding.
- `mixed-worker-first` means some contract routes are Worker-first and others
  are asset-first.

Do not normalize every app to one mode by default. Some frameworks intentionally
emit static or prerendered routes. The benchmark should disclose the mode and
rank only within compatible tier, route, render, data, and hydration buckets.

## Observability Policy

Workers Logs and Traces are useful for live trust gates, route diagnosis, and
deployment debugging. They are not a free benchmark variable.

- Live verification may rely on observability to diagnose failures.
- Timing runs must either standardize observability across comparable targets or
  disclose each target's setting in the config audit.
- Do not compare a result as canonical when observability, sampling, or
  diagnostic instrumentation differs in a way that could affect the measured
  route and is not recorded.

## Compatibility Flags

`nodejs_compat`, `nodejs_als`, and related flags are benchmark metadata, not
generic optimization advice. Some adapters require them. Record the flags because
they change runtime assumptions, polyfill availability, bundle shape, and startup
surface.

## Optimization Audit Controls

GitHub issue research identified recurring Cloudflare/framework optimization
failure modes: Worker startup drag from large or lazily uploaded module graphs,
server-only modules leaking into client bundles, broad prefetch defaults, static
routes remaining in Worker bundles, ambiguous asset/route caching, and hydration
work on the benchmark's `/chart` and `/media` routes.

The static control is:

```bash
pnpm cloudflare:optimization-audit --fail-on-gaps
```

The audit separates source-level optimization risks from benchmark disclosures.
A disclosure such as `nodejs-compat-startup-surface` or
`startup-size-needs-build-output` can be correct for OpenNext, Nitro, SvelteKit,
Waku, or another adapter that requires Node compatibility or emits a generated
Worker only after build. Canonical benchmark work should use the report to
decide what to measure or tune next, not to silently normalize framework
behavior across incompatible tiers.

The report records, per app:

- Worker entrypoint presence and a reproducible `wrangler check startup` probe
  command.
- Static asset header coverage and route `cache-control` evidence.
- Compatibility flags from Wrangler config.
- Prefetch/preload mode evidence.
- Server/client boundary leak scan results for common server-only imports.
- `/chart` and `/media` route-splitting, client-island, instrumentation, and
  hydration-risk evidence.

The companion catalog `bench/cloudflare-optimization-variants.json` records the
optimization variants that came out of GitHub/source research:

- Immutable static-asset cache contract checks for hashed assets.
- Assets-first versus Worker-first routing variants for wrapper and Hono
  baselines.
- Smart Placement and service-binding split experiments, isolated from
  canonical framework-runtime ranking.
- OpenNext Cloudflare cache-mode variants for static-assets cache and
  R2/regional cache configurations.
- Workerd-local startup probes using `wrangler check startup`.
- Trace/colo correlation fields for live result rows.
- Link header and HTTP 103 Early Hints evidence for preload-sensitive runs.
- Cloudflare platform-era provenance for Workers CPU/runtime and Pingora cache
  changes that affect cross-date timing interpretation.
- TanStack Start prerendering as an optimized-only prerender/static contract.
- Vinext as an excluded diagnostic comparator, not a framework peer.

Use optimization changes only inside comparable buckets. For example, disabling
unbounded prefetch is a fair same-contract change, while converting a runtime
SSR route into static output changes the route contract and belongs in the
prerender/static bucket.

The active platform-era catalog lives in
`bench/cloudflare-platform-eras.json`. Do not compare results across platform
eras as if the Workers runtime and cache behavior were unchanged. The May 2026
Pingora cache rollout is especially relevant for `stale-while-revalidate`,
TTFB, and bypass streaming interpretation.

## Framework Notes

### Astro

Use `@astrojs/cloudflare` for Workers. Astro 6 requires Node.js 22+ for Workers
Builds, so `.nvmrc`, CI, and documented prerequisites must stay on Node 22 or
newer. This repo classifies the current Astro entry as static-heavy/prerendered
for benchmark ranking even though the framework supports hybrid output.

### Next.js

Use the OpenNext Cloudflare path for Workers. `next dev` is not evidence of the
canonical runtime path; verification must exercise OpenNext build/preview/deploy
or the deployed Worker. Node middleware support remains a framework/adaptor
caveat and should not be assumed from local Next behavior.

### React Router

Cloudflare's React Router framework guide is the full-stack SSR Worker path.
It is not the SPA/prerender mode. A React + Vite app that uses React Router as a
client library belongs in the wrapper-baseline bucket, not the React Router
framework-runtime bucket.

### Qwik

Cloudflare integration support exists, but this repo's Qwik package line is
beta. Keep its caveats split into Cloudflare support, framework maturity, and
runtime proof status. The current Qwik row is blocked and excluded from
canonical runs because fresh Worker deploys with `@qwik.dev/router`
`2.0.0-beta.34` returned Q14 task-resolution error pages; re-enable it only
after a source-built Worker passes the v5 live contracts.

### Waku

Cloudflare integration support exists, but Waku remains alpha in this repo. Keep
its caveats split into Cloudflare support, framework maturity, and runtime proof
status. Its current benchmark implementation is classified as static-heavy in
this repo until live probes prove a different route contract.

### TanStack Start

The canonical TanStack Start rows remain framework-runtime SSR entries. Native
Workers prerendering support is valuable, but it changes the route/render
contract and belongs in an optimized-only `framework-prerender` variant rather
than the headline runtime bucket.

### Wrapper And Worker Baselines

React, Solid, Vue, Hono, and Hono-composite entries are useful baselines. They
must not be ranked as native framework-runtime peers. Worker-first routing is
expected for custom wrapper baselines when the Worker owns the document contract.

## Trust Gates

For canonical runs, use this minimum chain:

1. Static verification passes, including `pnpm cloudflare:config-audit --fail-on-gaps`.
2. The relevant framework build emits the Cloudflare Worker output path.
3. Wrangler dry-run, preview, deploy, or live Workers verification exercises the
   deployed Worker path.
4. Contract report proves routes, APIs, cache headers, selectors, `server-timing`,
   and Cloudflare config disclosure.
5. Benchmark result verification checks provenance, row hashes, run order, and
   contract output before any Markdown report is used for ranking.
6. Live result rows include Cloudflare trace metadata (`cf-ray`, derived colo,
   cache status, cache-control, Link headers, HTTP 103 Early Hints evidence,
   age, date, and parsed `server-timing`) so edge placement, preloading, and
   cache outliers are visible in JSON, Markdown, and row hashes.
