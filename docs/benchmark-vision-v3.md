# Benchmark Vision v3

## Objective

Benchmark Cloudflare-supported web frameworks on live Cloudflare Workers where the framework is the only experimental variable.

## Non-negotiable rules

- Workers-only runtime: no Cloudflare Pages targets in benchmark runs.
- Live edge targets: benchmark against deployed endpoints, not localhost.
- Strict parity: all benchmarked frameworks must implement the same routes, selectors, API contracts, and cache-profile behavior.
- No legacy template drift: deprecated scaffolds and static shortcut pipelines are removed.
- Deterministic datasets: shared dataset package drives all framework implementations.

## Framework scope

The source of truth for supported frameworks is `pnpm create cloudflare@latest --help`.
`bench/framework-matrix.json` must mirror that list exactly and carry per-framework status (`implemented`, `planned`, `blocked`).

## Benchmark suites

- `mpa_airbnb`: multi-page listing/blog behavior
- `spa_trading_media`: chart and media SPA behavior

## Output policy

- Produce suite-specific result files (`results.v3.<suite>.json/.md`) for full benchmark runs.
- Use suffixed artifacts for non-canonical modes:
  - smoke: `results.v3.<suite>.smoke.json/.md`
  - flame: `results.v3.spa_trading_media.flame.json/.md`
  - stability summary: `results.v3.stability.json/.md`
- Do not blend fundamentally different rendering contracts into one scoreboard.
- Any framework that fails contracts is reported explicitly as blocked for that run.

## Enforcement

- `scripts/check-matrix-drift.mjs`: blocks drift against current C3 framework list.
- `scripts/verify-workers-targets.mjs`: blocks non-Workers targets.
- `scripts/verify-live.mjs`: canonical live preflight (`check:matrix`, `check:targets`, `test:contracts`, `smoke`).
- `scripts/bench-stability.mjs`: repeated live parity benchmark runs with summarized output and default cleanup of raw repeat files.

## Operational commands

- `pnpm verify:live`: PR-safe live preflight.
- `pnpm bench:smoke`: parity benchmark smoke with suffixed outputs.
- `pnpm bench:flame`: manual spa flamegraph run with dedicated flame outputs.
- `pnpm bench:stability`: repeated parity smoke benchmark with `--repeats <n>` and optional `--keep-results`.
- CI runs `pnpm verify:live`; scheduled/manual benchmark workflow runs full benchmarks after preflight and can optionally add flamegraphs and stability.
