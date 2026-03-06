# Metrics Glossary

This glossary defines the metrics reported in `bench/results.v4.<suite>.json` and
`bench/results.v4.<suite>.md`. Summary tables use p50 (median) across iterations.

## Scope

- Server and network metrics: TTFB, server-timing.
- Client metrics: LCP, CLS, INP, FCP, TBT, CPU durations, JS heap, chart timing,
  media timing, and client-nav timing.

## Core metrics

| Metric | Unit | Source | Definition |
|--------|------|--------|------------|
| TTFB | ms | Navigation Timing | `responseStart` for the document. Includes network + server time. |
| LCP | ms | Web Vitals | Largest Contentful Paint timing. |
| CLS | unitless | Web Vitals | Cumulative Layout Shift score. |
| INP | ms | Web Vitals | Interaction to Next Paint. |
| FCP | ms | Web Vitals or Paint Timing | First Contentful Paint. |
| TBT | ms | Long Tasks | Total blocking time between FCP and FCP + 5000ms, summing time over 50ms per task. |
| CPU (TaskDuration) | ms | CDP Performance.getMetrics | Cumulative main-thread task time since navigation start. |
| CPU (ScriptDuration) | ms | CDP Performance.getMetrics | Time spent executing JS on the main thread. |
| CPU (LayoutDuration) | ms | CDP Performance.getMetrics | Time spent in layout on the main thread. |
| CPU (RecalcStyleDuration) | ms | CDP Performance.getMetrics | Time spent recalculating styles. |
| Heap (JSHeapUsedSize) | bytes | CDP Performance.getMetrics | Used JS heap size. Shown as KB/MB in tables. |
| Heap (JSHeapTotalSize) | bytes | CDP Performance.getMetrics | Total JS heap size. |
| Resources (js/css/img/font/other/total) | bytes | Resource Timing | Transfer size buckets for document resources. |

## Interaction metrics

| Metric | Unit | Source | Definition |
|--------|------|--------|------------|
| Chart switch | ms | App marker | `window.__CF_BENCH__.chart.switchDurationMs` for symbol/timeframe changes. |
| Chart draw | ms | App marker | `window.__CF_BENCH__.chartCore.lastDrawMs` for last chart render. |
| Media open | ms | App marker | `window.__CF_BENCH__.media.openDurationMs` when opening a media item. |
| Media next | ms | App marker | `window.__CF_BENCH__.media.nextDurationMs` when advancing to the next item. |
| Client nav | ms | App timing | Time between click and route completion for the client-nav scenario. |

## Scenarios and phases

- MPA suite (`mpa_airbnb`): `home`, `stays`, `stay_detail`, `blog`, `blog_post`.
- SPA suite (`spa_trading_media`): `chart`, `media`.
- Phases: `cold` is first navigation in a fresh browser context; `warm` is a reload
  in the same context.

## Profiles

- `parity`: chart data fetches use `no-store` for equal caching across frameworks.
- `idiomatic`: framework defaults (chart data can be cached per framework).

## Flamegraph artifacts

When `--flamegraphs` is enabled, benchmark rows can include attached CPU profile artifacts:

| Field | Unit | Source | Definition |
|-------|------|--------|------------|
| `flamegraph.path` | path | CDP Profiler | Relative path to a Chrome `.cpuprofile` artifact for that run row. |
| `flamegraph.sampleCount` | samples | CDP Profiler | Number of CPU samples recorded during the scenario. |
| `flamegraph.totalDurationMs` | ms | CDP Profiler | Total sampled duration for the profile. |
| `flamegraph.topFrames[]` | ms, % | Derived | Top self-time frames from the captured profile for quick hotspot analysis. |
