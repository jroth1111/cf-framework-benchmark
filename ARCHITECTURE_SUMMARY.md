# Architecture Summary - Correct Approach

## Key Insight

**You were right!** Chart code IS different on each framework because:
- React uses `useState`, `useEffect`
- Solid uses `createSignal`, `createEffect`
- Svelte uses `writable` stores
- Qwik uses `useSignal`, `useVisibleTask$`

These are **fundamentally different APIs** and cannot be shared.

## The Solution: Shared + Framework-Specific

We share what CAN be shared, and keep framework-specific code separate:

```
📦 @cf-bench/chart-hooks
│
├── ✅ types.ts          (SHARED - All frameworks)
├── ✅ shared.ts         (SHARED - All frameworks)
│
├── 🔀 react.ts         (React-specific - useState, useEffect)
├── 🔀 solid.ts         (Solid-specific - createSignal, createEffect)
├── 🔀 svelte.ts        (Svelte-specific - writable stores)
├── 🔀 qwik.ts          (Qwik-specific - useSignal, useVisibleTask$)
│
└── index.ts             (Exports all of above)
```

## What's Shared ✅

| Item | Location | Used By |
|------|-----------|----------|
| `ChartIndicators` interface | `types.ts` | All frameworks |
| `ChartData` interface | `types.ts` | All frameworks |
| `fetchCandles()` function | `shared.ts` | All frameworks |
| `calculatePoints()` helper | `shared.ts` | All frameworks |
| `DEFAULT_INDICATORS` constant | `shared.ts` | All frameworks |

## What's Framework-Specific 🔀

| Framework | State API | Effect API | File |
|-----------|------------|-------------|-------|
| React | `useState`, `useRef` | `useEffect` | `react.ts` |
| Solid | `createSignal` | `createEffect` | `solid.ts` |
| Svelte | `writable()` | `$:` reactive | `svelte.ts` |
| Qwik | `useSignal` | `useVisibleTask$` | `qwik.ts` |

## Code Comparison

### Before (Duplicated in 7 apps)

```typescript
// apps/react-vite/src/pages/Chart.tsx (160 lines)
import { useState, useEffect } from "react";
async function fetchCandles(symbol, timeframe, points) { /* 20 lines */ }
const [symbol, setSymbol] = useState("BTC");
useEffect(() => { /* 40 lines of data fetching */ });

// apps/solid/src/pages/Chart.tsx (160 lines)
import { createSignal, createEffect } from "solid-js";
async function fetchCandles(symbol, timeframe, points) { /* 20 lines */ }
const symbol = createSignal("BTC");
createEffect(() => { /* 40 lines of data fetching */ });

// apps/sveltekit/src/routes/chart/+page.svelte (160 lines)
import { writable } from "svelte/store";
async function fetchCandles(symbol, timeframe, points) { /* 20 lines */ */
const symbol = writable("BTC");
$: { /* 40 lines of data fetching */ }
```

### After (Shared + Framework-Specific)

```typescript
// packages/chart-hooks/src/shared.ts (60 lines) - SHARED
export async function fetchCandles(symbol, timeframe, points) {
  // Same implementation for ALL frameworks
  // Better error messages
}

// packages/chart-hooks/src/react.ts (120 lines) - React-specific
export function useChart() {
  const [symbol, setSymbol] = useState("BTC");
  useEffect(() => { /* uses shared fetchCandles */ });
}

// packages/chart-hooks/src/solid.ts (110 lines) - Solid-specific
export function useChart() {
  const symbol = createSignal("BTC");
  createEffect(() => { /* uses shared fetchCandles */ });
}

// apps/react-vite/src/pages/Chart.tsx (60 lines) - 63% less!
import { useChart } from "@cf-bench/chart-hooks";
const { symbol, setSymbol, ... } = useChart();
```

## Benefits

### Before (Duplicated)
- ❌ Bug fix needed in 7 places
- ❌ Error messages inconsistent
- ❌ Constants scattered
- ❌ Type definitions different in each app
- ❌ Benchmark metrics tracking inconsistent

### After (Shared + Framework-Specific)
- ✅ Bug fix once in `shared.ts`, all apps benefit
- ✅ Consistent, better error messages
- ✅ Centralized constants
- ✅ Consistent types across all frameworks
- ✅ Same benchmark metrics everywhere
- ✅ Each framework uses its natural APIs
- ✅ No framework "contamination" (e.g., React hooks in Solid)

## Package Structure

```
packages/
├── bench-types/           # Shared types & benchmark helpers
│   ├── src/index.ts       # ChartMetrics, updateChartMetrics(), etc.
│   ├── package.json
│   └── tsconfig.json
│
├── bench-config/          # Shared constants
│   ├── src/index.ts       # BENCHMARK_TIMING, CHART_POINTS_BY_TIMEFRAME
│   ├── package.json
│   └── tsconfig.json
│
├── chart-hooks/          # Framework-specific + shared logic
│   ├── src/
│   │   ├── types.ts     # Shared: ChartIndicators, ChartData
│   │   ├── shared.ts    # Shared: fetchCandles(), helpers
│   │   ├── react.ts     # React: useChart() hook
│   │   ├── solid.ts     # Solid: useChart() hook
│   │   ├── svelte.ts    # Svelte: createChartStore()
│   │   ├── qwik.ts      # Qwik: useChartQwik()
│   │   └── index.ts    # Exports all
│   ├── package.json
│   └── tsconfig.json
│
├── chart-core/           # Vanilla JS canvas chart (unchanged)
└── dataset/             # Shared data generator (unchanged)
```

## How Each Framework Imports

### React (apps/react-vite)
```tsx
import { useChart } from "@cf-bench/chart-hooks";

const { symbol, timeframe, indicators, ... } = useChart();
// Uses useState, useEffect internally (React API)
```

### Solid (apps/solid)
```tsx
import { useChart as useSolidChart } from "@cf-bench/chart-hooks";

const { symbol, timeframe, indicators, ... } = useSolidChart();
// Uses createSignal, createEffect internally (Solid API)
```

### Svelte (apps/sveltekit)
```svelte
<script>
  import { createChartStore } from "@cf-bench/chart-hooks";

  const chartStore = createChartStore();
  // Uses writable stores internally (Svelte API)
</script>
```

### Qwik (apps/qwik)
```tsx
import { useChartQwik } from "@cf-bench/chart-hooks";

const { symbol, timeframe, indicators, ... } = useChartQwik();
// Uses useSignal internally (Qwik API)
```

### Astro (apps/astro)
```typescript
import { fetchCandles, calculatePoints } from "@cf-bench/chart-hooks";

// Uses vanilla JS (no state management framework)
```

## Build Status

```bash
# All shared packages compile successfully
pnpm -C packages/bench-types exec npx tsc          # ✅ Pass
pnpm -C packages/bench-config exec npx tsc        # ✅ Pass
pnpm -C packages/chart-hooks exec npx tsc         # ✅ Pass (framework deps optional)

# Framework-specific deps are optional peer dependencies
# Qwik, Solid, Svelte types are only needed when compiling those files
```

## Summary

| Aspect | Approach | Status |
|---------|-----------|--------|
| **Types** | ✅ Shared in `types.ts` | All frameworks use same interfaces |
| **Data Fetching** | ✅ Shared in `shared.ts` | Better errors, consistent behavior |
| **Constants** | ✅ Shared in `bench-config` | Single source of truth |
| **State Management** | 🔀 Framework-specific | Each uses native APIs |
| **Effects/Lifecycle** | 🔀 Framework-specific | Each uses native APIs |
| **Benchmark Metrics** | ✅ Shared helpers | Consistent across all |

**This is the CORRECT architecture for a poly-framework monorepo.**

We share what CAN be shared (logic, types, constants) while respecting each framework's unique APIs (state, effects, lifecycle).
