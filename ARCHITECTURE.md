# Chart Hooks Architecture - Shared vs Framework-Specific

## The Correct Approach

You're right - charting code IS different on each framework. But we can still share what's common.

---

## 🎯 What MUST Be Framework-Specific

| Aspect | React | Solid | Svelte | Qwik |
|---------|--------|-------|---------|------|
| State | `useState` | `createSignal` | `let` (reactive) | `useSignal` |
| Refs | `useRef` | `createRef` (optional) | `bind:this` | `useSignal` |
| Effects | `useEffect` | `createEffect` | `$:` (reactive) | `useVisibleTask$` |
| Lifecycle | `useEffect` | `onMount`, `onCleanup` | `onMount` | `useVisibleTask$` |
| Stores | N/A | N/A | `writable()` | N/A |

**These CANNOT be shared** - they're fundamentally different APIs.

---

## ✅ What CAN Be Shared

### 1. Types & Interfaces
```typescript
export interface ChartIndicators {
  sma20: boolean;
  sma50: boolean;
  ema20: boolean;
  volume: boolean;
}

export interface ChartData {
  symbol: string;
  timeframe: string;
  candles: Candle[];
}
```

### 2. Data Fetching Logic
```typescript
export async function fetchCandles(
  symbol: string,
  timeframe: string,
  points?: number
): Promise<ChartData> {
  // This is the SAME for all frameworks
  const opts = getChartFetchOptions();
  const response = await fetch(url, opts);
  // ...
}
```

### 3. Constants & Helpers
```typescript
export const DEFAULT_INDICATORS = { sma20: true, sma50: false, ... };
export function calculatePoints(timeframe: string): number;
```

### 4. Benchmark Metrics Helpers
```typescript
export { startChartSwitch, markChartReady, markChartError };
```

---

## 📦 Package Structure

```
@cf-bench/chart-hooks/
├── src/
│   ├── types.ts           # SHARED - Types for all frameworks
│   ├── shared.ts          # SHARED - fetchCandles, helpers
│   ├── react.ts           # REACT - useState, useEffect hooks
│   ├── solid.ts          # SOLID - createSignal, createEffect
│   ├── svelte.ts         # SVELTE - writable stores
│   ├── qwik.ts           # QWIK - useSignal utilities
│   └── index.ts          # Exports all of above
```

---

## 🔄 How Each Framework Uses It

### React (apps/react-vite)
```tsx
import { useChart } from "@cf-bench/chart-hooks";

const { symbol, timeframe, indicators, ... } = useChart();

// React uses useState internally
```

### Solid (apps/solid)
```tsx
import { useChart as useSolidChart } from "@cf-bench/chart-hooks";

const { symbol, timeframe, indicators, ... } = useSolidChart();

// Solid uses createSignal internally
```

### Svelte (apps/sveltekit)
```svelte
<script>
  import { createChartStore } from "@cf-bench/chart-hooks";

  const chartStore = createChartStore();
</script>

<!-- Svelte uses stores internally -->
<select value={$symbol} />
```

### Qwik (apps/qwik)
```tsx
import { useChartQwik } from "@cf-bench/chart-hooks";

const { symbol, timeframe, indicators, ... } = useChartQwik();

// Qwik uses useSignal internally
```

### Astro (apps/astro)
```typescript
import { fetchCandles, calculatePoints } from "@cf-bench/chart-hooks";

// Astro uses vanilla JS
```

---

## 📊 Code Comparison

### Before (Duplicated in 8 apps)

```
Total duplicate code: ~800 lines
- fetchCandles function: 20 lines × 8 = 160 lines
- State management: 60 lines × 8 = 480 lines
- Constants: 20 lines × 8 = 160 lines
```

### After (Shared + Framework-Specific)

```
@cf-bench/chart-hooks/
- types.ts: 30 lines (SHARED)
- shared.ts: 60 lines (SHARED)
- react.ts: 120 lines (React-specific)
- solid.ts: 110 lines (Solid-specific)
- svelte.ts: 130 lines (Svelte-specific)
- qwik.ts: 90 lines (Qwik-specific)
Total: 540 lines (vs 800 before)

Each app: ~40-60 lines (vs ~100 before)
Reduction: ~60% less code per app
```

---

## 🎨 The Visual Model

```
┌─────────────────────────────────────────────────────┐
│           @cf-bench/chart-hooks                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐  ┌────────────────┐            │
│  │  types.ts    │  │   shared.ts    │            │
│  │  (SHARED)    │  │    (SHARED)    │            │
│  └──────────────┘  └────────────────┘            │
│         ↓                  ↓                      │
│  ┌──────────────┬──────────────┬────────────┐ │
│  │  react.ts    │  solid.ts    │ svelte.ts  │ │
│  │  (useState)  │(createSignal)│ (stores)   │ │
│  └──────────────┴──────────────┴────────────┘ │
│         ↓                  ↓                      │
│  ┌────────────────────────────────────────┐     │
│  │           qwik.ts                    │     │
│  │      (useSignal)                    │     │
│  └────────────────────────────────────────┘     │
│                                                      │
└─────────────────────────────────────────────────────┘
         ↓                ↓                ↓
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ React Vite  │  │    Solid    │  │ SvelteKit   │
│ (useState)  │  │(createSignal)│  │  (stores)   │
└─────────────┘  └─────────────┘  └─────────────┘
```

---

## ✅ Benefits of This Architecture

1. **Type Safety** - Shared types ensure consistency across frameworks
2. **Error Handling** - Better error messages in shared fetchCandles
3. **Maintenance** - Fix bug once in shared.ts, all frameworks benefit
4. **Benchmark Consistency** - Same metrics tracking everywhere
5. **Framework Freedom** - Each framework uses its natural APIs

---

## 🚫 What We DON'T Do (Wrong Approach)

```typescript
// BAD: Trying to make one-size-fits-all
export function useChart() {
  const [state, setState] = useState(); // Won't work in Solid!
  // ...
}
```

```typescript
// BAD: Using React hooks in Solid
import { useState } from "react"; // Wrong!
const symbol = createSignal(); // Solid doesn't have useState
```

---

## 📝 Summary

| Aspect | Approach | Example |
|---------|-----------|---------|
| **State Management** | Framework-specific | `useState` (React), `createSignal` (Solid) |
| **Data Fetching** | ✅ Shared | `fetchCandles()` from `shared.ts` |
| **Types** | ✅ Shared | `ChartData`, `ChartIndicators` from `types.ts` |
| **Constants** | ✅ Shared | `DEFAULT_INDICATORS` from `shared.ts` |
| **Effects/Lifecycle** | Framework-specific | `useEffect` (React), `createEffect` (Solid) |

**Bottom line:** Each framework gets its own hook/store implementation, but they all use the same underlying data fetching logic, types, and constants.

This is the **correct architecture** for a poly-framework monorepo.
