# Cloudflare Framework Benchmark Harness (Monorepo)

This repository contains **the same demo site** implemented in multiple frameworks and deployed to **Cloudflare (free plan)**.

Framework implementations included:

- React + Vite (pre-rendered MPA) – `react-vite`
- React + Vite (client-only SPA) – `react-spa`
- Astro
- Next.js (OpenNext on Workers)
- TanStack Start
- SvelteKit
- Qwik (Qwik City)
- Solid (SolidJS + Vite)

## What this demo site contains

The app is intentionally **hybrid**:

1. **SPA-like section** (`/chart`)
   - TradingView-ish: interactive canvas chart, symbol switching without a full page reload.
2. **“App pages” section** (`/stays`, `/stays/:id`)
   - Airbnb-ish: listing index + listing detail pages.
3. **SSG blog** (`/blog`, `/blog/:slug`)
   - Blog index + post pages.

All apps use the **same dataset** (a shared workspace package) so the UX and content stay comparable.

## Benchmarking goals

We measure (synthetically, in a controlled browser) for each framework deployment:

- **TTFB-ish document timing** (from the Navigation Timing API)
- **Initial load** (DOMContentLoaded/load, LCP, etc where available)
- **Repeat view / subsequent load** (reload within the same browser context)
- **Client CPU + memory** (CDP Performance metrics + JS heap)
- **Chart interaction latency** (symbol/timeframe switch + draw time on `/chart`)

The benchmark runner lives in `bench/`.

## Metrics glossary

See `docs/metrics-glossary.md` for definitions and metric sources.

> Notes:
> - Browser-based “response time” includes network + TLS + CDN edge variance.
> - To reduce noise, the runner runs multiple iterations and summarizes medians.
> - You can run against local `wrangler dev` or against `*.workers.dev`.

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
pnpm -C apps/react-vite dev
pnpm -C apps/astro dev
pnpm -C apps/sveltekit dev
```

### 4) Deploy (per app)

Each app has a `deploy` script that calls `wrangler deploy` (or the framework’s Cloudflare adapter command).

Example:

```bash
pnpm -C apps/react-vite deploy
```

### 5) Benchmark

Edit `bench/bench.config.json` to point to your deployed URLs, then run:

```bash
pnpm -C bench run
```

Profiles:

- `--profile parity` (forces chart data fetches to `no-store`)
- `--profile idiomatic` (uses framework defaults)
- `--profile mobile-cold` (fast-4g throttling + CPU slowdown, warmup disabled)
- `--profile both` (default)

This produces:

- `bench/results.v2.json`
- `bench/results.v2.md`

Throughput (concurrency) check:

```bash
pnpm bench:load -- --path /stays --duration 15000 --concurrency 50
```

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
