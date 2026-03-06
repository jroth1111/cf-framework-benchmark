# Benchmark Vision v4

## Objective

Benchmark Cloudflare-supported web frameworks on live Cloudflare Workers while keeping route, selector, API, cache, and dataset contracts fixed enough that app drift does not dominate the results.

## Non-negotiable rules

- Workers-only runtime: no Cloudflare Pages targets in benchmark runs.
- Live edge targets: benchmark against deployed endpoints, not localhost.
- Strict parity: all benchmarked frameworks must implement the same routes, selectors, API contracts, and cache-profile behavior.
- Native framework entries only: shared control rendering is isolated to the standalone control app and does not appear in headline framework scoreboards.
- Deterministic datasets: shared dataset package drives all framework implementations.

## Framework scope

The source of truth for supported frameworks is `pnpm create cloudflare@latest --help`.
`bench/framework-matrix.json` mirrors that list and carries benchmark metadata:

- `benchmarkDefaults`: shared implementation kind and default scenario contracts.
- `scenarioContracts`: per-framework overrides when a route is prerendered or otherwise differs from the default rendering contract.

## Benchmark suites

- `mpa_airbnb`: multi-page listing/blog behavior
- `spa_trading_media`: chart and media interaction behavior

## Output policy

- Produce suite-specific result files (`results.v4.<suite>.json/.md`) for full benchmark runs.
- Use suffixed artifacts for non-canonical modes:
  - smoke: `results.v4.<suite>.smoke.json/.md`
  - flame: `results.v4.spa_trading_media.flame.json/.md`
  - stability summary: `results.v4.stability.json/.md`
- Scoreboards are bucketed by comparable rendering contracts; fundamentally different route contracts do not share a headline table.
- Any framework that fails contracts is reported explicitly as blocked for that run.

## Enforcement

- `scripts/check-matrix-drift.mjs`: blocks drift against the current C3 framework list.
- `scripts/verify-workers-targets.mjs`: blocks non-Workers targets.
- `scripts/verify-static.mjs`: PR-safe static validation (`check:matrix`, `check:targets`, `test:dataset`, `build`).
- `scripts/verify-live.mjs`: live preflight (`check:matrix`, `check:targets`, `test:contracts`, `smoke`).
- `scripts/bench-stability.mjs`: repeated live parity benchmark runs with summarized output and default cleanup of raw repeat files.

## Operational commands

- `pnpm verify:static`: default CI verification for code changes.
- `pnpm verify:live`: live preflight before publishing or benchmarking.
- `pnpm bench:smoke`: parity benchmark smoke with suffixed outputs.
- `pnpm bench:flame`: manual spa flamegraph run with dedicated flame outputs.
- `pnpm bench:stability`: repeated parity smoke benchmark with `--repeats <n>` and optional `--keep-results`.
- PR CI runs `pnpm verify:static`; the scheduled/manual benchmark workflow runs `pnpm verify:live` before benchmark execution.
