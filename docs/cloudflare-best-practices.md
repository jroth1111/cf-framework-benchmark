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
observability setting, and Workers Static Assets routing mode. The source
metadata lives in `bench/cloudflare-frameworks.json`; live Wrangler settings are
read from each app's `wrangler.toml` or `wrangler.jsonc`.

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
runtime proof status.

### Waku

Cloudflare integration support exists, but Waku remains alpha in this repo. Keep
its caveats split into Cloudflare support, framework maturity, and runtime proof
status. Its current benchmark implementation is classified as static-heavy in
this repo until live probes prove a different route contract.

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
