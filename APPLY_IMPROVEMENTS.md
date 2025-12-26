# Applying Improvements - Correct Architecture

## Summary of Changes Applied

### ✅ New Shared Packages Created

1. **`@cf-bench/bench-types`** - Type-safe benchmark metrics
   - Shared TypeScript interfaces
   - Helper functions for `window.__CF_BENCH__`
   - Works with ALL frameworks

2. **`@cf-bench/bench-config`** - Centralized constants
   - `BENCHMARK_TIMING` - All timing constants
   - `CHART_POINTS_BY_TIMEFRAME` - Points per timeframe
   - `BENCHMARK_PROFILES` - parity, idiomatic, mobile-cold
   - `API_PATHS`, `PAGE_ROUTES`, `TEST_SELECTORS`

3. **`@cf-bench/chart-hooks`** - Framework-specific + Shared logic
   - **`src/types.ts`** - Shared types (works everywhere)
   - **`src/shared.ts`** - Shared data fetching (works everywhere)
   - **`src/react.ts`** - React hooks (`useState`, `useEffect`)
   - **`src/solid.ts`** - Solid signals (`createSignal`, `createEffect`)
   - **`src/svelte.ts`** - Svelte stores (`writable`)
   - **`src/qwik.ts`** - Qwik utilities (`useSignal`)

---

## Framework Applications Updated

| Framework | File Updated | Approach |
|------------|---------------|-----------|
| React Vite | `src/pages/Chart.tsx` | Uses `useChart()` hook |
| TanStack Start | `app/routes/chart.tsx` | Uses `useChart()` hook |
| Next.js | `app/chart/ChartClient.tsx` | Uses `useChart()` hook |
| Astro | `src/scripts/chart-client.ts` | Uses shared `fetchCandles()` |
| SolidJS | `src/pages/Chart.tsx` | Uses `useChart()` hook |
| SvelteKit | `src/routes/chart/+page.svelte` | Uses `createChartStore()` |
| Qwik | `src/routes/chart/index.tsx` | Uses `useChartQwik()` |

---

## Code Reduction Per Framework

| Before | After | Reduction |
|---------|--------|-----------|
| ~160 lines | ~50 lines | **~70%** |

**Shared code eliminated:**
- Duplicate `fetchCandles()` function (20 lines × 7 apps = 140 lines saved)
- Duplicate state management logic (40 lines × 7 apps = 280 lines saved)
- Duplicate constants/magic numbers (10 lines × 7 apps = 70 lines saved)
- Duplicate error handling (15 lines × 7 apps = 105 lines saved)

**Total shared: ~595 lines**
**New packages: ~540 lines**
**Net savings across monorepo: ~55 lines + much better maintainability**

---

## What's Shared vs What's Framework-Specific

### ✅ Shared (All Frameworks Use Same Code)

```typescript
// src/types.ts - Shared interfaces
export interface ChartIndicators {
  sma20: boolean;
  sma50: boolean;
  ema20: boolean;
  volume: boolean;
}

// src/shared.ts - Shared data fetching
export async function fetchCandles(symbol, timeframe, points) {
  const opts = getChartFetchOptions();  // from @cf-bench/bench-types
  const response = await fetch(url, opts);
  // Same logic for all frameworks!
}
```

### 🔀 Framework-Specific (Different API, Different Code)

```typescript
// src/react.ts - React-specific
export function useChart() {
  const [symbol, setSymbol] = useState("BTC");  // React API
  useEffect(() => { ... });  // React API
}

// src/solid.ts - Solid-specific
export function useChart() {
  const symbol = createSignal("BTC");  // Solid API
  createEffect(() => { ... });  // Solid API
}

// src/svelte.ts - Svelte-specific
export function createChartStore() {
  const symbol = writable("BTC");  // Svelte API
  // Svelte uses stores, not hooks
}
```

---

## Files Modified

### New Packages
```
packages/
├── bench-types/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/index.ts
├── bench-config/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/index.ts
└── chart-hooks/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── types.ts
        ├── shared.ts
        ├── react.ts
        ├── solid.ts
        ├── svelte.ts
        ├── qwik.ts
        └── index.ts
```

### Updated Apps
```
apps/
├── react-vite/
│   ├── package.json (added chart-hooks dependency)
│   └── src/pages/Chart.tsx (refactored)
├── tanstack-start/
│   ├── package.json (added chart-hooks dependency)
│   └── app/routes/chart.tsx (refactored)
├── nextjs/
│   ├── package.json (added chart-hooks dependency)
│   └── app/chart/ChartClient.tsx (refactored)
├── astro/
│   ├── package.json (added bench-types, bench-config dependencies)
│   └── src/scripts/chart-client.ts (refactored)
├── solid/
│   ├── package.json (added chart-hooks dependency)
│   └── src/pages/Chart.tsx (refactored)
├── sveltekit/
│   ├── package.json (added chart-hooks dependency)
│   └── src/routes/chart/+page.svelte (refactored)
└── qwik/
    ├── package.json (added chart-hooks dependency)
    └── src/routes/chart/index.tsx (refactored)
```

---

## Testing

```bash
# Install dependencies
pnpm install

# Build shared packages
pnpm -C packages/bench-types exec npx tsc
pnpm -C packages/bench-config exec npx tsc
pnpm -C packages/chart-hooks exec npx tsc --skipLibCheck
```

---

## Benefits

1. **Type Safety** - All frameworks get consistent types
2. **Better Error Messages** - Shared `fetchCandles()` with context
3. **Single Source of Truth** - Constants centralized
4. **Benchmark Consistency** - Same metric tracking everywhere
5. **Framework Freedom** - Each uses its native APIs
6. **Easier Maintenance** - Fix bug once in shared.ts

---

## Migration Notes

Each framework keeps its own state management approach:
- React uses `useState`, `useEffect`
- Solid uses `createSignal`, `createEffect`
- Svelte uses `writable` stores
- Qwik uses `useSignal`, `useVisibleTask$`

But they all:
- Import `fetchCandles` from shared
- Use types from `types.ts`
- Track metrics with `bench-types` helpers
- Use constants from `bench-config`

**This is the correct architecture for a poly-framework monorepo.**
