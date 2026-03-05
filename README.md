# Cloudflare Framework Benchmark Harness (Monorepo)

This repository contains **the same demo site** implemented in multiple frameworks and deployed to **Cloudflare (free plan)**.

Framework implementations included:

- React
- Astro
- Next.js (OpenNext on Workers)
- SvelteKit
- Qwik (Qwik City)
- Solid (SolidJS + Vite)

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

The benchmark runner lives in `bench/`.

## Metrics glossary

See `docs/metrics-glossary.md` for definitions and metric sources.

> Notes:
> - Browser-based “response time” includes network + TLS + CDN edge variance.
> - To reduce noise, the runner runs multiple iterations and summarizes medians.
> - v3 benchmarks are Workers-only and run against live `*.workers.dev` targets.

## Prerequisites

- Node.js 20+
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
pnpm -r build
```

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

- `bench/results.v3.mpa_airbnb.json`
- `bench/results.v3.mpa_airbnb.md`
- `bench/results.v3.spa_trading_media.json`
- `bench/results.v3.spa_trading_media.md`

Throughput (concurrency) check:

```bash
pnpm bench:load -- --path /stays --duration 15000 --concurrency 50
```

Flamegraph capture (CPU stacks for eval analysis):

```bash
pnpm bench:flame
# or target custom scope
pnpm -C bench exec node src/run-v3.mjs --suite spa_trading_media --profile parity --iterations 1 \
  --flamegraphs \
  --flamegraph-frameworks react,next,nuxt \
  --flamegraph-scenarios chart,media \
  --flamegraph-phases cold
```

This writes `.cpuprofile` artifacts under `bench/flamegraphs/<timestamp>/` and includes hotspot summaries in
`bench/results.v3.<suite>.json` + `.md`.

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
- Run benchmarks from the **same machine/network**.
- Run at least **10 iterations** and compare medians.

## License

MIT
