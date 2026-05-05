# Contrarian Review

## Top claims challenged

### 1. "Prerender more routes" is automatically the best optimization
- Challenge: this is only true if the benchmark rewards first-load HTML speed more than runtime SSR parity.
- Why it may be wrong:
  - It changes the implementation category from request-time rendering to build-time output.
  - Some route families such as listings/details can become unfairly advantaged compared with frameworks intentionally exercising runtime loaders or RSC.
- Conclusion:
  - Treat prerender/static conversion as a policy choice, not a default engineering cleanup.

### 2. "Add more prefetch/preload" improves performance
- Challenge: benchmark workloads are especially sensitive to background work.
- Why it may be wrong:
  - Global hover or render prefetch can inflate memory, CPU, and network usage without helping the measured step.
  - It can make navigation numbers look better while making cold-load metrics worse.
- Conclusion:
  - Prefer targeted per-link prefetch after measuring real benchmark flows.

### 3. "Lazy-load the chart route everywhere"
- Challenge: this clearly helps initial route bundles, but it can harm route-entry interaction timing.
- Why it may be wrong:
  - If a benchmark opens `/chart` directly and immediately manipulates controls, the chunk fetch can shift cost onto the hot path.
  - Some frameworks already isolate `/chart` enough that further laziness yields diminishing returns.
- Conclusion:
  - Lazy-loading chart code is high-confidence for home/listings/blog entry paths, but not automatically best for direct chart benchmarks.

### 4. "Remove `nodejs_compat` wherever possible"
- Challenge: this is attractive but not yet proven across the matrix.
- Why it may be wrong:
  - Some frameworks or adapters may indirectly depend on Node compatibility even if app code looks web-native.
  - The real bundle/startup win must be measured on emitted Workers, not inferred from source.
- Conclusion:
  - Keep this as a verification task, not a blanket recommendation.

### 5. "Use advanced framework features" always beats simpler designs
- Challenge: experimental or ecosystem-specific features can buy speed at the cost of stability and comparability.
- Examples:
  - SolidStart islands are still experimental.
  - Waku is still alpha.
  - React Compiler may help but needs stability validation.
- Conclusion:
  - Prefer mature, broadly supported optimizations first: chunk splitting, smaller client boundaries, loader/server data, and selective prefetch.

## What survives the contrarian pass
- The single most robust optimization across the matrix is reducing shipped/hydrated JS on chart/media and content routes.
- The second most robust optimization is replacing blanket prefetch with measured, selective route warming.
- The third most robust optimization is keeping first-load data on the server or in route loaders instead of mount-time browser fetches.
