# Metrics Glossary

This glossary defines the metrics reported in `bench/results.v2.json` and
`bench/results.v2.md`. Summary tables use p50 (median) across iterations.

## Scope

- Server and network metrics: TTFB, server-timing.
- Client metrics: LCP, CLS, INP, FCP, TBT, CPU durations, JS heap, chart timing,
  and client-nav timing.

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
| Client nav | ms | App timing | Time between click and route completion for the client-nav scenario. |

## Scenarios and phases

- Scenarios: `home`, `stays`, `blog`, `chart`, and `spa_nav`.
- Phases: `cold` is first navigation in a fresh browser context; `warm` is a reload
  in the same context.

## Profiles

- `parity`: chart data fetches use `no-store` for equal caching across frameworks.
- `idiomatic`: framework defaults (chart data can be cached per framework).

