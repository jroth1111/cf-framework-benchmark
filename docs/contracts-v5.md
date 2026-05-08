# Benchmark Contract v5

This contract is the authority for canonical Cloudflare framework benchmark runs.
It exists to keep the project honest: a result is only rankable when the framework,
route behavior, data behavior, and measurement profile match the contract declared
for that row.

## Objective

Compare Cloudflare-supported web frameworks on live Workers without hiding
implementation differences. The benchmark reports what happened under a declared
contract; it does not publish a flat "best framework" claim across incompatible
runtime classes.

## Runtime Contract

- Targets must be live HTTPS `*.workers.dev` or custom-domain Workers endpoints.
- Cloudflare Pages targets are excluded from canonical runs.
- Localhost, preview servers, and static file snapshots are diagnostic only.
- The shared dataset in `packages/dataset` is the content source for every app.
- Required APIs, routes, selectors, and cache behavior are part of the benchmark
  contract, not optional app details.
- Cloudflare config disclosure is part of the runtime contract. Each enabled
  Workers target must pass `pnpm cloudflare:config-audit -- --fail-on-gaps` so
  the result records the adapter, support/maturity label, Wrangler entrypoint,
  Static Assets routing mode, compatibility flags, and observability setting.
- A route served asset-first, Worker-first, or Worker-only is not silently
  equivalent. Scoreboards may compare those routes only when the route contract
  and Cloudflare config mode are compatible or explicitly bucketed.

## Entry Classes

`bench/framework-matrix.json` assigns every enabled entry to one tier:

| Tier | Meaning | Ranking Policy |
| --- | --- | --- |
| `framework-runtime` | Framework-owned full-stack runtime on Workers. | Headline rankings, bucketed by route contract. |
| `framework-prerender` | Framework entry that prerenders or serves static-heavy benchmark routes. | Ranked only with comparable prerender/static-heavy entries. |
| `wrapper-baseline` | Custom Worker plus a frontend library shell, without a framework-owned runtime. | Baseline tables only, never a framework-runtime peer. |
| `worker-baseline` | Hono or Hono plus a UI library, primarily Worker-owned HTML/API behavior. | Control/baseline tables only. |
| `framework-experimental` | Scaffolded, blocked, or in-progress entry. | Excluded from canonical scoreboards. |

Wrappers stay in scope because they are useful baselines, but they are not allowed
to win a framework-runtime scoreboard. Deleting them would remove useful context;
mixing them into native-runtime rankings would be misleading.

## Route Contract

Canonical suites require these public routes:

| Suite | Routes |
| --- | --- |
| `mpa_airbnb` | `/`, `/stays`, `/stays/:id`, `/blog`, `/blog/:slug` |
| `spa_trading_media` | `/chart`, `/media` |

For every route, the matrix declares or inherits:

- `renderMode`: `ssr`, `prerender`, `spa`, or another explicit mode.
- `initialData`: `document`, `client-fetch`, `static-json`, or explicit equivalent.
- `hydrationModel`: `framework`, `island`, `none`, or `client-only`.
- `implementationKind`: native framework, adapter, custom wrapper, or baseline.

Routes may differ by framework only when the matrix says so. Scoreboards group by
route contract, tier, and implementation class so a prerendered page does not
share a headline column with runtime SSR.

## Required Selectors

Selectors are the cross-framework UI contract. They must identify real rendered
content, not hidden placeholders.

| Route | Required selectors |
| --- | --- |
| `/stays` | `data-testid="stay-card"` |
| `/stays/:id` | `data-testid="stay-description"` |
| `/blog` | `data-testid="blog-post-card"` |
| `/blog/:slug` | `data-testid="blog-html"` |
| `/chart` | `data-testid="chart-canvas"`, `symbol-select`, `timeframe-select` |
| `/media` | `data-testid="media-card"`, `media-player`, `media-next` |

The contract reporter must reject responses that satisfy selectors with empty,
invisible, or shell-only markup when the route claims rendered content. Live
browser smoke must also reject workload drift: `/media` must expose exactly
`BENCH_MEDIA_PAGE_SIZE` `media-card` items in the route DOM, and `/chart` must
expose every shared chart symbol and timeframe option in the route DOM.
Framework-runtime and framework-prerender routes whose matrix contract declares
`hydrationModel: framework` must also include script evidence in the HTML
response; route-level script suppression is an optimized/bucket-changing
behavior, not a canonical framework-hydration row.

## API Contract

Every benchmarked target must serve:

- `/api/bench`
- `/api/health`
- `/api/listings?pageSize=1`
- `/api/listings/001`
- `/api/prices?symbol=BTC&timeframe=1h&points=120`
- `/api/media?pageSize=3`

API responses must be JSON, return successful status codes, include the expected
shape from `docs/contracts-v3.md`, and expose `server-timing` with benchmark
server timing.

## Cache Contract

The parity profile is allowed to override chart data fetches to `no-store`.
Document routes must report the route-specific cache policy declared by the app
contract:

The canonical (idiomatic-profile) values below are owned by `contracts/v5.json`
and emitted by `@cf-bench/bench-cache`. The parity profile downgrades non-hifi
cacheable HTML routes to `no-store`; hifi routes always emit the canonical value
because the hifi suite measures cached responses.

| Route | Expected document cache policy |
| --- | --- |
| `/`, `/chart`, `/media` | `no-store` |
| `/stays`, `/blog` | `public, max-age=0, s-maxage=60, stale-while-revalidate=300` |
| `/stays/:id`, `/blog/:slug` | `public, max-age=0, s-maxage=300, stale-while-revalidate=600` |

Cache-control mismatches block canonical ranking for the affected target.

## Interaction Contract

`/chart` must support symbol/timeframe changes that alter the chart state and
emit app markers under `window.__CF_BENCH__`. `/media` must support opening a
media item and advancing to the next item with corresponding markers. App
markers are accepted only with independent browser evidence from Playwright/CDP
and real DOM state.

## Result Classes

| Class | Use |
| --- | --- |
| `canonical` | Clean git tree, live Workers targets, v5 contract report passed, seeded order, row hashes, full provenance, global geography coverage (APAC + US + EU). |
| `canonical-MEL-only` | All canonical requirements met except geography: run from MEL colo only. Treated as a single-region reference; not a global claim. |
| `canonical-apac-only` | APAC coverage present; US and EU missing. |
| `canonical-us-only` | US coverage present; APAC and EU missing. |
| `canonical-eu-only` | EU coverage present; APAC and US missing. |
| `canonical-apac+us` | APAC and US coverage present; EU missing. |
| `canonical-no-geo` | No `cf-ray` / colo headers observed; geography unverifiable. |
| `diagnostic` | Dirty tree, partial framework set, skipped contract report, local target, or exploratory profile. |
| `smoke` | Fast sanity run with suffixed output. Never a headline source. |
| `flame` | CPU profile investigation with suffixed output. |
| `optimized` | Explicitly tuned variants. Never mixed into canonical framework scoreboards. |

Canonical unsuffixed result files are refused when the git tree is dirty.
Diagnostic runs must use suffixed filenames or explicit flags.
Every result file self-labels its `result.canonical.class`; non-global classes emit a Limitations note in the generated Markdown report.

## Scoring Model Versioning

The scoring rubric (`bench/scoring-rubric.json`) is versioned independently from the v5 contract. Its `model` field (e.g., `real-world-choice-v2`) increments when metric weights or scenario weights change materially. The rubric hash is stored in `provenance.hashes.scoring` and is included in the benchmark provenance summary, but it is **not** part of `provenance.hashes.contract` — rubric changes do not invalidate the contract hash. Old runs remain legible against their declared model version.

## Anti-Gaming Requirements

- Markdown reports must be verifiable from JSON results.
- Each result row must carry a provenance hash derived from raw metrics, commit,
  seed, framework, scenario, phase, and iteration.
- The runner must record matrix, targets, contract, Cloudflare config audit, and
  lockfile hashes.
- Run order must be randomized with a recorded deterministic seed.
- Outlier and scoring policy must live in code and be written into reports.
- Tier changes must be reviewed through matrix drift checks.
- Contract failures are reported as blocked/incomplete, not slow.

## Canonical Geography

Canonical geography coverage is defined in `bench/canonical-geography.json` as APAC + US + EU. The region-to-colo mapping is in `bench/colo-regions.json`. These regions are reported separately and are not averaged into a global winner because geography, network path, and Cloudflare colo behavior are material parts of Workers timing.

The runner self-labels every result with `result.canonical.class` (see Result Classes above). Canonical writes that fail the geography requirement are redirected to a `.regional.` filename unless `--allow-incomplete-geography` is passed explicitly. The Markdown report emits a Limitations note for any non-global coverage class.

## Failure Policy

A target with route, selector, API, cache, marker, provenance, or result
verification failures is excluded from canonical ranking for that run. It remains
visible in failure summaries so the absence is auditable.
