# Cloudflare Workers Limits And Benchmark Interpretation

This benchmark targets Cloudflare Workers. Platform limits are part of the
runtime contract and must be interpreted alongside timing results.

## Limit Classes To Track

- CPU time: SSR-heavy and data-heavy routes can fail or tail-latency spike when
  request CPU limits are approached.
- Memory: framework runtime size, module-scope initialization, and large in-memory
  fixtures can affect isolate pressure.
- Worker size: generated bundles and OpenNext/Nitro/adapter output can approach
  script size limits differently by framework.
- Startup time: cold isolate startup and module evaluation are material to first
  request behavior.
- Static assets: asset count, per-file size, routing mode, and asset-first versus
  Worker-first behavior affect whether a request exercises Worker code at all.
- Logs and traces: observability is useful for trust gates, but sampling and
  volume settings are benchmark metadata.

## Project Policy

- Treat limit-related failures as contract failures, not as slow results.
- Report a target as excluded or blocked when it cannot satisfy the route/API
  contract inside the target Cloudflare plan and runtime limits.
- Keep bundle/startup/dry-run evidence with the deployment or contract report
  when the framework adapter exposes it.
- Record `compatibility_flags`, Static Assets routing, and observability settings
  via `pnpm cloudflare:config-audit`.

## Result Interpretation

Benchmark rows are not comparable across hidden platform modes. A route served by
Static Assets before Worker code, a route handled by a full-stack SSR Worker, and
a route served by a custom Worker baseline are different runtime contracts. Rank
only within compatible tier, route, render mode, data mode, hydration model, and
Cloudflare config mode.
