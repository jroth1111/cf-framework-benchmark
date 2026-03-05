# Benchmark Contracts v3

## Runtime contract

Every benchmarked target must run on Cloudflare Workers.

`GET /api/bench` must include:

- `isolateId` (string)
- `hits` (number)
- `now` (number)
- `runtime` = `"cloudflare-workers"`
- `framework` (string)
- `contractVersion` = `"v3.0.0"`
- `suiteSupport` (string array)

## Shared API contract

Required endpoints:

- `GET /api/bench`
- `GET /api/health`
- `GET /api/listings`
- `GET /api/listings/:id`
- `GET /api/prices`
- `GET /api/media`

Required response headers:

- `content-type: application/json; charset=utf-8`
- `server-timing: cf_bench;dur=...;desc="<isolate-id>"`

Cache policy defaults:

- `bench/health`: `no-store`
- listing index + prices + media list: `public, max-age=0, s-maxage=60`
- listing detail + media detail: `public, max-age=0, s-maxage=300`
- errors: `no-store`

## UI route contract

Required routes:

- `/`
- `/stays`
- `/stays/:id`
- `/blog`
- `/blog/:slug`
- `/chart`
- `/media`

Required selectors:

- stays: `[data-testid="stay-card"]`, `[data-testid="stay-description"]`
- blog: `[data-testid="blog-post-card"]`, `[data-testid="blog-html"]`
- chart: `[data-testid="chart-canvas"]`, `[data-testid="symbol-select"]`, `[data-testid="timeframe-select"]`
- media: `[data-testid="media-card"]`, `[data-testid="media-player"]`, `[data-testid="media-next"]`

## Benchmark markers

`window.__CF_BENCH__` must exist on all benchmark pages.

Chart markers:

- `chart.ready` true on success and error
- `chart.error` + `chart.errorMessage` on failure
- `chart.switchDurationMs` on symbol/timeframe change
- `chartCore.lastDrawMs` populated

Media markers:

- `media.ready` true once listing is interactive
- `media.openDurationMs` when opening a media item
- `media.nextDurationMs` when advancing to next media item

