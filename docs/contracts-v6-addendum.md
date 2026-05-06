# Benchmark Contract v6 Addendum — Hifi Suite

This document is an additive extension to `docs/contracts-v5.md`. It governs
the `mpa_airbnb_hifi` suite and the `mobile-hifi` runner profile. v5 remains
authoritative for the existing `mpa_airbnb` and `spa_trading_media` suites.
v6 does not supersede v5; the two coexist with separate scoreboards.

## Objective

Capture a realistic mobile guest experience on an Airbnb-shaped MPA with
high-fidelity content (hero image, photo gallery, reviews, booking widget,
static map) and realistic third-party JavaScript weight. v5's `mpa_airbnb`
suite is intentionally minimal to expose framework hydration differences;
the hifi suite intentionally raises the floor of payload, content, and
runtime weight so rankings reflect a realistic mobile-first guest journey.

## Relationship to v5

- v5 routes (`/`, `/stays`, `/stays/:id`, `/blog`, `/blog/:slug`) and their
  selectors and cache contracts remain unchanged.
- v6 introduces additive routes (`/hifi/stays`, `/hifi/stays/:id`) under the
  same Worker. Existing v5 routes stay live and benchmarked under v5.
- v5 and v6 results are reported in separate scoreboards. Cross-suite ranking
  is forbidden.
- v5 result files (`bench/results.v4.mpa_airbnb.{json,md}`) remain the
  canonical record for that suite and are not invalidated by v6 work.

## Route Contract

The hifi suite (`mpa_airbnb_hifi`) requires:

| Route | Required selectors | Document cache policy | Render |
| --- | --- | --- | --- |
| `/` | (shared with v5) `a[href="/stays"]` | `no-store` | shared |
| `/hifi/stays` | `data-testid="stay-card"` | `public, s-maxage=60, stale-while-revalidate=300` | SSR |
| `/hifi/stays/:id` | `stay-hero-image`, `stay-gallery`, `stay-reviews`, `stay-booking-form`, `stay-booking-total`, `stay-map` | `public, s-maxage=300, stale-while-revalidate=86400` | SSR |
| `/blog`, `/blog/:slug` | (shared with v5) | shared | shared |

## Required Selectors

| Selector | On | Purpose |
| --- | --- | --- |
| `data-testid="stay-hero-image"` | `/hifi/stays/:id` | LCP target. `<img>` with `fetchpriority="high"`, explicit width/height, served via `/cdn-cgi/image/`. Above the fold. |
| `data-testid="stay-gallery"` | `/hifi/stays/:id` | Photo grid (4-col). 7 of 8 photos use `loading="lazy"` and `decoding="async"`. |
| `data-testid="stay-reviews"` | `/hifi/stays/:id` | Reviews list rendered server-side from `listing.reviewSamples`. |
| `data-testid="stay-booking-form"` | `/hifi/stays/:id` | Sticky `<form>` with checkin, checkout, guests inputs. Performs price-breakdown computation on submit. |
| `data-testid="stay-booking-total"` | `/hifi/stays/:id` | Element that appears after booking-form submit, containing computed total. The journey's INP wait selector. |
| `data-testid="stay-map"` | `/hifi/stays/:id` | Static map tile via `mapTilesUrl`. No third-party map JS. |

The contract reporter must reject `/hifi/stays/:id` responses missing any of
these selectors; partial coverage does not satisfy the route.

## Content Contract

The shared dataset (`packages/dataset`) is the single source for hifi content.
Optional `Listing` fields populated by the generator:

- `photos: string[]` — exactly 8 URLs through `/cdn-cgi/image/` transforms.
- `heroPhoto: string` — `photos[0]`. The route's LCP target.
- `hostAvatar: string`.
- `mapTilesUrl: string` — single static tile URL.
- `descriptionHtmlHifi: string` — ~60–80 DOM elements; richer than v5's
  `descriptionHtml`. The v5 `descriptionHtml` field MUST remain byte-identical.
- `nightsAvailable: number[]` — booking-widget calendar input.

Frameworks must consume these fields verbatim; per-framework substitution is
a fairness violation.

## Image Origin Contract

All hifi images route through
`/cdn-cgi/image/format=auto,fit=cover,width=…/<origin-url>`. Frameworks unable
to enable Image Transformations on their Workers domain are flagged
`hifi-blocked` and excluded from hifi scoreboards (analogous to v5's
`framework-experimental` policy).

## Third-Party SDK Weight Contract

Hifi pages must include two deferred external scripts in the document head:

```html
<script async src="/__bench/sdk/maps.js"></script>
<script async src="/__bench/sdk/analytics.js"></script>
```

Both endpoints are served by the shared `packages/bench-contract` Worker
extension and return deterministic, byte-identical payloads to every
framework:

- `/__bench/sdk/maps.js` — ~80 KB gzipped. Simulates Google Maps SDK weight.
  Parses an embedded JSON blob, registers a custom element. No outbound
  network calls.
- `/__bench/sdk/analytics.js` — ~35 KB gzipped. Simulates Stripe + analytics
  weight; sets up a `MutationObserver` and sends a beacon to
  `/__bench/beacon`.
- `/__bench/beacon` — `204 No Content`.

Per-framework substitution, omission, or recompression of these payloads is
a contract violation.

## Interaction Contract

The hifi suite runs a 5-step mobile journey on `/hifi/stays/:id`:

1. **Cold-load** `/hifi/stays?city=Lisbon`. Capture CWV (LCP, CLS, INP, FCP).
2. **Click** first `[data-testid="stay-card"]`. Wait for
   `[data-testid="stay-hero-image"]` paint. Record click INP and hero LCP.
3. **Click** `[data-testid="stay-gallery"] img:nth-child(2)`. Record INP.
4. **Fill** `[data-testid="stay-booking-form"] input[name="checkin"]`, blur,
   submit. Wait for `[data-testid="stay-booking-total"]`. Record
   form-computation INP.
5. **Reload** the same URL with the same browser context (warm cache,
   bfcache eligible). Tag metrics `phase: "repeat-view"`.

Interactions must produce real DOM state changes; markers without DOM
evidence are rejected by the runner the same way v5 chart/media markers are.

## Profile Contract

The canonical hifi profile is `mobile-hifi`:

- Device: Playwright `devices['iPhone 13']` (375×812 viewport, real mobile UA).
- Throttling: `fast-4g` (1.6 Mbit/s down, 0.75 Mbit/s up, 150 ms RTT).
- Warmup: disabled.
- Iterations: 10.
- Journey: `airbnb-search-to-book` (above).
- Repeat-view phase: enabled.

Diagnostic runs may also use `parity`, `idiomatic`, or `mobile-cold` against
the hifi suite for comparison; only `mobile-hifi` results are canonical for
hifi rankings.

## Cache Contract Additions

| Route | Required `cache-control` |
| --- | --- |
| `/hifi/stays` | `public, s-maxage=60, stale-while-revalidate=300` |
| `/hifi/stays/:id` | `public, s-maxage=300, stale-while-revalidate=86400` |

The contract-tests runner extends `expectedHtmlCache(route)` to validate these
policies for hifi routes.

## Result Files

- `bench/results.v4.mpa_airbnb_hifi.{json,md}` — canonical hifi results.
- `bench/results.v4.mpa_airbnb.{json,md}` — v5 results, authoritative for the
  v5 suite, not invalidated by v6.

## Anti-Gaming Additions

All v5 anti-gaming requirements (provenance hashes, recorded matrix/contract
hashes, randomized run order with recorded seed, audit gates) apply to v6 runs.
Additionally:

- The byte length of `descriptionHtmlHifi` for any single listing must match
  across all hifi-enabled frameworks (single dataset source enforces this).
- The byte size of `/__bench/sdk/maps.js` and `/__bench/sdk/analytics.js`
  responses must match across frameworks (single `packages/bench-contract`
  extension enforces this).
- LCP smell test: aggregate p75 LCP on `mobile-hifi` for a healthy hifi run
  is expected to land above 1500 ms. A run reporting hifi LCP under 500 ms
  suggests the SDK weight was elided or the hero image substituted; flag
  for review before publishing.

## Phase 1 vs Phase 2

Phase 1 ships hifi routes in five reference frameworks: `next`, `redwood`,
`svelte`, `qwik`, `solidstart`. Frameworks not yet shipping hifi routes are
flagged `hifi-pending` and excluded from hifi scoreboards until they land.

Phase 2 expands to the remaining 13 frameworks, adds BrowserStack real-device
hooks, the MotoG4 mobile WebPageTest profile, and a Lighthouse comparison
harness against airbnb.com itself.
