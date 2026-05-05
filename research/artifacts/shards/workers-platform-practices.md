# workers-platform-practices

#### Findings

- **[workers-platform-practices-F01]** Workers Static Assets are the Cloudflare-aligned default for new static, SPA, and full-stack apps on Workers. - Claim type: best-practice - Confidence: HIGH - [Workers Best Practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) + [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) - As-of: 2026-04-23
  - Evidence basis: primary Cloudflare docs
  - Source family: Cloudflare Workers docs
  - Applicability: broad; Workers, not Pages; applies to framework benchmark variants with static assets
  - Methodology or limitations: N/A
  - Counterevidence or caveat: Pages still works, but Cloudflare says new features/optimizations are focused on Workers.
  - Why it matters: benchmark configs should prefer Workers Static Assets over legacy Pages-style or bundled-static approaches.

- **[workers-platform-practices-F02]** Asset routing mode materially changes benchmark behavior: default is asset-first; `run_worker_first=true` invokes Worker code before assets; route arrays can selectively invoke Worker code for API paths. - Claim type: benchmark / best-practice - Confidence: HIGH - [Static Assets: Configuration and Bindings](https://developers.cloudflare.com/workers/static-assets/binding/) + [Worker script routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) - As-of: 2026-04-23
  - Evidence basis: primary spec
  - Source family: Cloudflare Workers docs
  - Applicability: full-stack apps mixing static assets and APIs
  - Methodology or limitations: N/A
  - Counterevidence or caveat: `run_worker_first=true` is valid for auth/logging/rewrites, but it is not parity-neutral for static asset performance.
  - Why it matters: framework variants should not mix asset-first and worker-first routing unless the benchmark buckets that as a deliberate architecture difference.

- **[workers-platform-practices-F03]** SPA fallback behavior changed around navigation requests: with `not_found_handling="single-page-application"` and compatibility date `2025-04-01` or later, navigation misses can serve `index.html` without invoking the Worker script. - Claim type: capability / pricing / benchmark - Confidence: HIGH - [Single Page Application routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/) - As-of: 2026-04-23
  - Evidence basis: primary spec
  - Source family: Cloudflare Workers docs
  - Applicability: SPA/client-heavy benchmark variants
  - Methodology or limitations: N/A
  - Counterevidence or caveat: browser navigation to an API-looking route may return HTML, while `fetch("/api/...")` still invokes Worker code.
  - Why it matters: route/API contract checks must test both browser navigations and client fetch/API requests.

- **[workers-platform-practices-F04]** Static asset cache behavior is automatic and tiered; browser defaults are conservative revalidation, while fingerprinted assets can use long immutable browser cache headers. - Claim type: benchmark / best-practice - Confidence: HIGH - [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) + [Static Assets headers](https://developers.cloudflare.com/workers/static-assets/headers/) - As-of: 2026-04-23
  - Evidence basis: primary spec
  - Source family: Cloudflare Workers docs
  - Applicability: static asset benchmarking, repeat-view browser measurements
  - Methodology or limitations: N/A
  - Counterevidence or caveat: `_headers` rules do not apply to Worker-generated/SSR responses.
  - Why it matters: benchmark methodology should record cache-warm state, `CF-Cache-Status`, and whether immutable headers are applied consistently.

- **[workers-platform-practices-F05]** Cache API behavior is not equivalent to built-in Static Assets or `fetch` caching: Cache API is data-center-local and does not support tiered caching. - Claim type: benchmark / reliability - Confidence: HIGH - [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) + [How the Cache works](https://developers.cloudflare.com/workers/reference/how-the-cache-works/) - As-of: 2026-04-23
  - Evidence basis: primary spec
  - Source family: Cloudflare Workers docs
  - Applicability: SSR/framework adapters that implement their own response or page cache
  - Methodology or limitations: N/A
  - Counterevidence or caveat: Cache API is appropriate for some programmatic caching, but it changes locality and warmup behavior.
  - Why it matters: variants using framework caches, Cache API, Static Assets, or CDN/fetch cache need separate labels.

- **[workers-platform-practices-F06]** Smart Placement can improve backend-bound Worker code but can distort asset measurements: static assets are normally served nearest to the request, while assets fetched through the assets binding are served where the Worker runs; `run_worker_first` can add latency for asset requests. - Claim type: benchmark / best-practice - Confidence: HIGH - [Placement](https://developers.cloudflare.com/workers/configuration/placement/) + [Static Assets binding](https://developers.cloudflare.com/workers/static-assets/binding/) - As-of: 2026-04-23
  - Evidence basis: primary spec
  - Source family: Cloudflare Workers docs
  - Applicability: full-stack SSR/API benchmarks, especially with remote databases/APIs
  - Methodology or limitations: Smart Placement needs traffic and may take up to 15 minutes to analyze.
  - Counterevidence or caveat: Cloudflare warns Smart Placement + `run_worker_first` may not optimize split edge/static vs backend behavior correctly.
  - Why it matters: Smart Placement should be either disabled for parity or benchmarked as a separate backend-optimized bucket with placement status recorded.

- **[workers-platform-practices-F07]** Bundle size and startup time are benchmark-relevant limits: Worker gzip size is 3 MB Free / 10 MB Paid, pre-compression size is 64 MB, startup time is 1 second, and Wrangler reports `startup_time_ms` during deploy/version upload. - Claim type: limits / benchmark - Confidence: HIGH - [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) - As-of: 2026-04-23
  - Evidence basis: primary spec
  - Source family: Cloudflare Workers docs
  - Applicability: upgraded framework packages, SSR bundles, adapters with large dependency graphs
  - Methodology or limitations: deploy validation is the platform check; dry-run reports upload size but not full live performance.
  - Counterevidence or caveat: Paid plan CPU time differs from Free, so plan must be recorded.
  - Why it matters: benchmark CI should capture bundle gzip size and `startup_time_ms` after package upgrades.

- **[workers-platform-practices-F08]** Observability should be enabled for production-like Workers, but sampling must be controlled because default full sampling can add volume/cost and traces are separately configured. - Claim type: observability / pricing / best-practice - Confidence: HIGH - [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) + [Traces](https://developers.cloudflare.com/workers/observability/traces/) + [Workers Best Practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) - As-of: 2026-04-23
  - Evidence basis: primary spec
  - Source family: Cloudflare Workers docs
  - Applicability: live benchmark deployments with intermittent errors or performance regressions
  - Methodology or limitations: logs and traces have separate sampling in newer config shapes.
  - Counterevidence or caveat: Observability is not a performance optimization; use it for diagnostics and record whether it is enabled during measured runs.
  - Why it matters: benchmark runs should standardize or disclose `observability`, log sampling, and trace sampling.

#### Local Recommendation Inputs

- Add a config audit that records per variant: `assets.directory`, `assets.binding`, `assets.run_worker_first`, `assets.not_found_handling`, `html_handling`, `placement`, `observability`, compatibility date/flags, and Worker plan assumptions.
- Treat asset-first, worker-first, Smart Placement, Cache API, and framework-level cache variants as separate benchmark buckets unless every framework uses the same semantics.
- Add live route probes for static asset hit/miss headers, SPA navigation fallback, API `fetch` behavior, custom 404 behavior, and SSR response headers.
- Add post-upgrade verification capturing `wrangler deploy --dry-run` upload size and live deploy/version output containing `startup_time_ms`.
- Record cache warmup state and `CF-Cache-Status` in browser measurements; avoid comparing cold static assets against warmed SSR/API routes.
- For observability, enable logs for live troubleshooting but standardize sampling and disclose whether it is enabled during benchmark runs.

#### Gaps

- Cloudflare docs do not provide framework-by-framework parity guidance for benchmark methodology.
- Public docs do not quantify the latency overhead of `run_worker_first` or Smart Placement for specific asset workloads.
- Public docs explain Cache API locality but do not provide a simple benchmark recipe for comparing Static Assets vs SSR-generated cached HTML.
- Smart Placement status requires account/API access and real traffic; docs cannot prove a given benchmark deployment has reached `SUCCESS`.
- Pricing/observability docs explain event quotas and sampling, but not precise runtime overhead of logging/tracing for microbenchmarks.

#### Queries Used

- `site:developers.cloudflare.com/workers/static-assets Workers Static Assets run_worker_first not_found_handling assets binding routing`
- `site:developers.cloudflare.com/workers/vite-plugin static assets Cloudflare Vite plugin vite preview workerd`
- `site:developers.cloudflare.com/workers/best-practices Workers Static Assets observability logs cache API global scope startup`
- `site:developers.cloudflare.com/workers/platform/limits CPU time startup time Worker size Static Asset files wrangler dry-run`
- `site:developers.cloudflare.com/workers/configuration/placement Smart Placement Workers Assets run_worker_first`
- `site:developers.cloudflare.com/workers/observability/logs/workers-logs wrangler observability enabled head_sampling_rate`
- `site:developers.cloudflare.com/workers/runtime-apis/cache Workers Cache API static assets cache headers`
- `site:developers.cloudflare.com/workers/static-assets headers redirects cache-control immutable`
- `site:developers.cloudflare.com/workers/wrangler/commands deploy dry-run startup_time_ms wrangler versions upload preview`
- `site:developers.cloudflare.com/workers/development-testing wrangler dev remote local workerd vite preview`
- `Cloudflare Workers Static Assets run_worker_first performance`
- `Cloudflare Smart Placement static assets warning`
- `Cloudflare Workers startup_time_ms limits framework SSR`
- `Cloudflare Workers observability sampling costs`

#### Sources

- [Workers Best Practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) - cross-cutting Cloudflare guidance for config, architecture, observability, code patterns - 2026-04-23 - primary - Cloudflare Workers docs
- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) - Static Assets behavior and caching - 2026-04-23 - primary - Cloudflare Workers docs
- [Static Assets: Configuration and Bindings](https://developers.cloudflare.com/workers/static-assets/binding/) - `run_worker_first`, assets binding, Smart Placement interaction - 2026-04-23 - primary - Cloudflare Workers docs
- [Single Page Application routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/) - SPA fallback and navigation behavior - 2026-04-23 - primary - Cloudflare Workers docs
- [Worker script routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) - asset-first default, worker-first caveats - 2026-04-23 - primary - Cloudflare Workers docs
- [Static Assets headers](https://developers.cloudflare.com/workers/static-assets/headers/) - default/cache/custom header behavior - 2026-04-23 - primary - Cloudflare Workers docs
- [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) - Cache API semantics and limits - 2026-04-23 - primary - Cloudflare Workers docs
- [How the Cache works](https://developers.cloudflare.com/workers/reference/how-the-cache-works/) - fetch vs Cache API and tiered caching boundary - 2026-04-23 - primary - Cloudflare Workers docs
- [Placement](https://developers.cloudflare.com/workers/configuration/placement/) - Smart Placement behavior/status/limitations - 2026-04-23 - primary - Cloudflare Workers docs
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) - CPU, size, startup, Static Asset limits - 2026-04-23 - primary - Cloudflare Workers docs
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) - logging enablement, sampling, limits/pricing - 2026-04-23 - primary - Cloudflare Workers docs
- [Traces](https://developers.cloudflare.com/workers/observability/traces/) - tracing enablement, sampling, billing caveat - 2026-04-23 - primary - Cloudflare Workers docs
- [Development & testing](https://developers.cloudflare.com/workers/development-testing/) - local workerd/Miniflare behavior and remote bindings - 2026-04-23 - primary - Cloudflare Workers docs
