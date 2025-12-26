# Benchmark Contracts

This document defines the parity contracts that make the benchmark results comparable across frameworks.

## Canonical URLs
- Use **no trailing slash** URLs (e.g., `/stays`, `/blog`, `/chart`).
- Bench runner navigates to canonical paths; frameworks should avoid redirecting to slash variants.

## Required UI routes and anchors
- `/` Home
- `/stays` Stays index
  - Must render cards with `data-testid="stay-card"`.
- `/stays/:id` Stay detail
  - Must render description with `data-testid="stay-description"` (or consistent equivalent).
- `/blog` Blog index
  - Must render cards with `data-testid="blog-post-card"` (or consistent equivalent).
- `/blog/:slug` Blog post
  - Must render HTML with `data-testid="blog-html"` (or consistent equivalent).
- `/chart` Chart page
  - Must render:
    - `data-testid="chart-canvas"`
    - `data-testid="symbol-select"`
    - `data-testid="timeframe-select"`

## Benchmark markers
- `window.__CF_BENCH__` must be present.
- Chart contract:
  - `window.__CF_BENCH__.chart.ready` is set to `true` on success **or error**.
  - `window.__CF_BENCH__.chart.error` + `errorMessage` are set on failure.
  - `window.__CF_BENCH__.chart.switchDurationMs` is set on symbol/timeframe switch.
  - `window.__CF_BENCH__.chartCore.lastDrawMs` is updated via `chart-core` stats.
- Script boot metric (objective):
  - The runner uses CDP `ScriptDuration` as a proxy for boot/hydration cost.
- Hydration markers (optional, diagnostic only):
  - `window.__CF_BENCH__.hydration.startMs` set as early as possible on the client.
  - `window.__CF_BENCH__.hydration.endMs` set when hydration is complete.

## Rendering mode metadata
Each framework must declare rendering intent in `bench/bench.config.json`:
- `rendering: { home, stays, blog, chart }` values: `ssr`, `ssg`, `csr`, `spa`.
- `delivery` values: `ssr-worker` or `worker-assets`.
- `features.clientNav` (boolean) gates the client-nav scenario.

Bench results should be compared **within the same rendering bucket**.

## Buckets and scoring
- Score tables are computed **per bucket** using `delivery` + `rendering` for `home/stays/blog/chart`.
- No single global score is reported across buckets.

## Rendering contracts
- **Stays SSR** (`rendering.stays = ssr`): query params must affect initial HTML. Contract tests validate
  `GET /stays?city=...` contains the expected number of `data-testid="stay-card"` entries.
- **Blog SSG/SSR** (`rendering.blog = ssg|ssr`): initial HTML must include `data-testid="blog-post-card"`
  on the index and `data-testid="blog-html"` on post pages. CSR frameworks are bucketed separately.

## Profile header and page caching
- The runner sends `x-cf-bench-profile` on page requests.
- For `idiomatic` and `mobile-cold` profiles, SSR page responses should set:
  - List pages (`/stays`, `/blog`): `public, max-age=0, s-maxage=60, stale-while-revalidate=300`
  - Detail pages (`/stays/:id`, `/blog/:slug`): `public, max-age=0, s-maxage=300, stale-while-revalidate=600`
- For `parity`, SSR pages should return `cache-control: no-store` (static pages are unaffected).

## API contracts
Required endpoints:
- `GET /api/bench` → `{ isolateId, hits, now }`
- `GET /api/health` → `{ ok: true, ts }`
- `GET /api/listings` → `{ total, totalPages, page, pageSize, results }`
- `GET /api/listings/:id` → `{ listing }` or `{ error: "not_found" }` with `404`
- `GET /api/prices?symbol=...` → `{ symbol, timeframe, candles }` or `{ error: "unknown_symbol" }` with `400`

Headers for JSON endpoints:
- `content-type: application/json; charset=utf-8`
- `server-timing: cf_bench;dur=...;desc="<isolate-id>"`
- `cache-control`:
  - **success**: `public, max-age=0, s-maxage=60` (listings list + prices)
  - **detail**: `public, max-age=0, s-maxage=300` (listing detail)
  - **errors**: `no-store`
  - **bench/health**: `no-store`

## Service worker policy
- Service workers must be disabled for benchmarking unless **all** frameworks register equivalent SWs.

## Client navigation scenario
- A `client-nav` scenario is only run if `features.clientNav === true`.
- Required defaults:
  - From `/` → click `a[href="/stays"]` → wait for `[data-testid="stay-card"]`.
- Dynamic client-nav scenario:
  - From `/stays` → click `[data-testid="stay-card"]` → wait for `[data-testid="stay-description"]`.

## Throttling (optional)
- `bench/bench.config.json` may define `throttlingProfiles` and set `throttling` per profile.
- CLI overrides: `--throttle <profile>` or `--cpu <rate> --network <profile>`.
- Profiles may also override `warmup` and `iterations`; CLI `--skip-warmup`/`--iterations` win.

## First request (cold only)
- When warmup is disabled, the first cold iteration is reported separately as "first request".

## Contract checks
- `scripts/contract-tests.mjs` validates API schemas + SSR HTML contracts.
- `scripts/smoke.mjs` validates UI anchors + chart error markers.

## HTML trust boundary
- HTML fields in the dataset are considered trusted constants for this benchmark.
- If dataset content becomes user-controlled, add sanitization and update this contract.
