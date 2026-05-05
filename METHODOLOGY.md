# Benchmark Methodology

This project benchmarks Cloudflare-supported web frameworks on live Workers. The
goal is not a flat "fastest framework" claim. The goal is an honest,
contract-aware comparison: under a declared route/render/data/cache/hydration
contract, on live Workers targets, with recorded provenance, what did each entry
do?

The authoritative contract is `docs/contracts-v5.md`.

## Comparison Surface

The shared app has four surfaces:

- Airbnb-ish MPA routes: `/`, `/stays`, `/stays/:id`
- SSG/content routes: `/blog`, `/blog/:slug`
- TradingView-ish SPA route: `/chart`
- YouTube-ish media route: `/media`

All apps use `packages/dataset` for deterministic content and must expose the
same required selectors and API routes before they are rankable.

## Entry Classes

Results are grouped by the tier declared in `bench/framework-matrix.json`:

| Tier | Interpretation |
| --- | --- |
| `framework-runtime` | Native framework runtime or adapter on Workers. |
| `framework-prerender` | Static or prerender-heavy framework entry. |
| `wrapper-baseline` | Custom Worker plus frontend library shell. |
| `worker-baseline` | Worker/Hono baseline behavior. |
| `framework-experimental` | Blocked or scaffolded entry. |

Headline tables never mix these tiers. Cross-tier data can appear as context,
but not as a ranking.

## Canonical Run Requirements

A canonical result must have:

- clean git provenance
- live Workers targets only
- passing v5 contract report
- matrix, targets, contract, and lockfile hashes
- recorded browser, Playwright, host, and git metadata
- deterministic run seed
- row-level provenance hashes
- documented scoring model
- JSON and Markdown result verification
- at least 10 iterations for publishable runs, with 30 preferred
- MEL + US + EU remote coverage when making geography-sensitive claims

Dirty, smoke, flame, partial, optimized, and skipped-contract runs are
diagnostic unless explicitly marked otherwise.

## Run Order

Within each profile, the runner shuffles framework/scenario/iteration units with
a recorded deterministic seed. Cold and warm phases stay paired inside each unit
so direct cold/warm contrast remains understandable while framework ordering no
longer follows a fixed matrix order.

## Scoring

The composite score is `real-world-choice-v1`. It is intended to help a user
choose a framework combination for a hybrid content + interactive app on
Workers. It is lower-is-better and computed only within comparable
profile/phase/tier/contract buckets.

Metric weights:

| Metric | Weight | Reason |
| --- | ---: | --- |
| LCP | 0.30 | Primary user-perceived load outcome. |
| TBT | 0.20 | Captures main-thread cost that affects interaction readiness. |
| TTFB | 0.15 | Important on live Workers, but geography/network sensitive. |
| Interaction latency | 0.15 | Captures chart/media usefulness after load. |
| Script boot time | 0.10 | Penalizes heavy client startup. |
| JS transfer | 0.05 | Bandwidth and cache pressure. |
| JS heap | 0.05 | Runtime footprint and low-memory risk. |

Scenario weights:

| Scenario | Weight |
| --- | ---: |
| home | 0.10 |
| stays | 0.25 |
| blog | 0.20 |
| chart | 0.25 |
| media | 0.20 |

Metrics are min-max normalized inside each comparable bucket. Missing metrics are
omitted and observed weights are renormalized. A framework with failed or
incomplete required scenario samples is not ranked for that bucket.

The score is a decision aid, not a substitute for raw metric tables. For narrow
use cases, choose the scenario and metric that match the workload.

## Geography

The canonical remote geography set is MEL + US + EU. The repository defaults to
WebPageTest locations:

- `MEL_AU_03:Chrome.Native`
- `IAD_US_01:Chrome.Native`
- `DUB_IE_01:Chrome.Native`

Regions are reported separately. Do not average them into one global number.

## Anti-Reward-Hacking Controls

The benchmark treats gaming as part of the threat model:

- `scripts/verify-results.mjs` checks JSON/Markdown consistency and row hashes.
- `scripts/contract-report.mjs` blocks targets that fail route/API/cache/selector
  checks before canonical benchmarking.
- canonical output refuses dirty-tree unsuffixed result paths.
- row hashes make direct JSON metric edits visible.
- seeded randomization makes selective ordering visible.
- tiers are validated by matrix drift checks.

These controls do not prove a framework implementation is perfect. They raise
the cost of cheap benchmark manipulation and make diagnostic results harder to
launder into canonical claims.

## Publication Policy

Canonical artifacts belong under `bench/results/` or workflow artifacts with a
date and commit. Large exploratory outputs, dirty optimized variants, smoke
runs, and flamegraphs should use suffixed names and stay out of headline
scoreboards unless intentionally archived as diagnostic evidence.
