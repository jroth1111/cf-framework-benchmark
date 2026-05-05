# Cloudflare Framework Benchmark Harness (Monorepo)

This repository contains the same benchmark app implemented across Cloudflare-supported frameworks and deployed to live Cloudflare Workers targets.

Framework entries are classified before they are ranked:

| Tier | Entries | Ranking policy |
| --- | --- | --- |
| `framework-runtime` | Next.js, Nuxt, Qwik, React Router, RedwoodSDK, SvelteKit, TanStack Start | Headline tables, bucketed by route/render/data/hydration contract. |
| `framework-prerender` | Angular, Astro, Vike, Waku | Ranked separately from runtime SSR entries. |
| `wrapper-baseline` | React, Solid, Vue | Custom Worker + frontend library baselines; not framework-runtime peers. |
| `worker-baseline` | Hono, Hono + frontend composites | Worker/Hono baselines; useful context, not framework-runtime rankings. |
| `framework-experimental` | Analog, SolidStart variants, incomplete composites | Excluded until the matrix marks them benchmark-enabled. |

The standalone control implementation lives in `apps/control` and `bench/controls.json`. It is used for live verification and appendix baselines, not headline framework scoreboards.

## What this demo site contains

The app is intentionally **hybrid**:

1. **SPA-like section** (`/chart`)
   - TradingView-ish: interactive canvas chart, symbol switching without a full page reload.
2. **Media SPA section** (`/media`)
   - YouTube-ish: feed + player interactions (open item, next item).
3. **“App pages” section** (`/stays`, `/stays/:id`)
   - Airbnb-ish: listing index + listing detail pages.
4. **SSG blog** (`/blog`, `/blog/:slug`)
   - Blog index + post pages.

All apps use the **same dataset** (a shared workspace package) so the UX and content stay comparable.

## Benchmarking goals

We measure (synthetically, in a controlled browser) for each framework deployment:

- **TTFB-ish document timing** (from the Navigation Timing API)
- **Initial load** (DOMContentLoaded/load, LCP, etc where available)
- **Repeat view / subsequent load** (reload within the same browser context)
- **Client CPU + memory** (CDP Performance metrics + JS heap)
- **Chart interaction latency** (symbol/timeframe switch + draw time on `/chart`)
- **Media interaction latency** (open + next actions on `/media`)

The benchmark runner lives in `bench/`. The methodology is documented in
`METHODOLOGY.md`; the canonical contract is `docs/contracts-v5.md`.

## Metrics glossary

See `docs/metrics-glossary.md` for definitions and metric sources.

> Notes:
> - Browser-based “response time” includes network + TLS + CDN edge variance.
> - To reduce noise, the runner runs multiple iterations and summarizes medians.
> - v4 benchmarks are Workers-only and run against live `*.workers.dev` targets.

## Prerequisites

- Node.js 22+
- pnpm (recommended) or npm/yarn
- Cloudflare account (free plan)
- Wrangler CLI (`pnpm add -g wrangler` or use `npx wrangler`)

## Quickstart

### 1) Install

```bash
pnpm install
```

### 2) Build

```bash
pnpm build:enabled
```

`pnpm -r build` is a broader diagnostic sweep for experimental and disabled
workspaces; it is not the default PR/canonical verification gate.

### 3) Run locally (per app)

Each app has its own `dev` / `preview` scripts. Examples:

```bash
pnpm -C apps/react dev
pnpm -C apps/astro dev
pnpm -C apps/svelte dev
```

### 4) Deploy (per app)

Each app has a `deploy` script that calls `wrangler deploy` (or the framework’s Cloudflare adapter command).

Example:

```bash
pnpm -C apps/react deploy
```

### 5) Benchmark

Update `bench/targets.live.json` URLs, then run:

```bash
pnpm bench
pnpm bench:spa
# or run both suites
pnpm bench:all
```

Profiles:

- `--profile parity` (forces chart data fetches to `no-store`)
- `--profile idiomatic` (uses framework defaults)
- `--profile mobile-cold` (fast-4g throttling + CPU slowdown, warmup disabled)
- `--profile both` (default)

This produces:

- `bench/results.v4.mpa_airbnb.json`
- `bench/results.v4.mpa_airbnb.md`
- `bench/results.v4.spa_trading_media.json`
- `bench/results.v4.spa_trading_media.md`

Throughput (concurrency) check:

```bash
pnpm bench:load -- --path /stays --duration 15000 --concurrency 50
```

Flamegraph capture (CPU stacks for eval analysis):

```bash
pnpm bench:flame
# or target custom scope
pnpm -C bench exec node src/run-v4.mjs --suite spa_trading_media --profile parity --iterations 1 \
  --flamegraphs \
  --flamegraph-frameworks react,next,nuxt \
  --flamegraph-scenarios chart,media \
  --flamegraph-phases cold
```

This writes `.cpuprofile` artifacts under `bench/flamegraphs/<timestamp>/` and includes hotspot summaries in
`bench/results.v4.<suite>.json` + `.md`.

Static verification for pull requests runs `pnpm verify:static`. Live contract checks stay in `pnpm verify:live` and in the benchmark workflow preflight.

Contract and result integrity helpers:

```bash
pnpm cloudflare:config-audit -- --fail-on-gaps
pnpm cloudflare:optimization-audit -- --fail-on-gaps
pnpm contract:report -- --fail-on-violations
pnpm verify:results -- --json bench/results.v4.mpa_airbnb.json --allow-legacy
```

Canonical benchmark runs execute the contract report before measuring. Use
`--skip-contract-report` only for explicitly diagnostic runs.
Cloudflare config disclosure is part of static verification: the audit records
each app's adapter, framework support status, maturity label, Wrangler entry,
Static Assets routing mode, compatibility flags, and observability setting.
The optimization audit adds Worker startup probe commands, asset/header evidence,
prefetch mode disclosure, server/client boundary leak scans, explicit benchmark
disclosures, `/chart` + `/media` route/client-work evidence, and the tracked
optimization-variant catalog in `bench/cloudflare-optimization-variants.json`.
Benchmark rows also carry Cloudflare trace metadata (`cf-ray`, derived colo,
cache status, cache-control, age, date, and parsed `server-timing`) so edge
placement and cache outliers are part of result provenance.

## Directory layout

- `packages/dataset` – shared content (listings + blog posts + price series generator)
- `packages/ui` – tiny shared CSS + helpers (optional)
- `apps/*` – one app per framework
- `bench/` – Playwright benchmark runner

## Reproducibility tips

For more stable comparisons:

- Use the **same custom domain pattern** (one per framework), e.g.:
  - `react.example.com`, `next.example.com`, ...
- Disable Cloudflare features that can distort measurements (e.g. Rocket Loader).
- Keep a clean git tree for canonical unsuffixed result files.
- Reuse or record the `--seed` value when reproducing a run.
- Run at least **10 iterations**; use **30** for canonical public reports.
- Compare medians with dispersion (`p95`, `IQR`) rather than single-millisecond p50 differences.
- Do not compare across tiers or contract buckets.
- Report MEL, US, and EU remote runs separately; geography is part of Workers performance, not noise to average away.

## License

MIT
