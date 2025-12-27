/**
 * Svelte stores/actions for chart functionality
 * Uses SHARED data fetching from shared.ts
 * Framework-specific: writable stores, $
 */

import { writable, derived, get } from "svelte/store";
import { chartSymbols, chartTimeframes } from "@cf-bench/dataset";
import {
  startChartSwitch,
  markChartReady,
  markChartError,
  updateChartCoreMetrics,
} from "@cf-bench/bench-types";
import { DEFAULT_CHART_CONFIG } from "@cf-bench/bench-config";
import { fetchCandles, calculatePoints, DEFAULT_INDICATORS } from "./shared";
import type { ChartIndicators, ChartData } from "./types";
import type { Writable } from "svelte/store";

export interface ChartStore {
  symbol: Writable<string>;
  timeframe: Writable<string>;
  indicators: Writable<ChartIndicators>;
  status: Writable<"idle" | "loading" | "ready" | "error">;
  data: Writable<ChartData | null>;
  error: Writable<Error | null>;
  symbols: readonly string[];
  timeframes: readonly string[];
  setSymbol: (s: string) => void;
  setTimeframe: (tf: (typeof chartTimeframes)[number]) => void;
  setIndicators: (i: Partial<ChartIndicators> | ((prev: ChartIndicators) => ChartIndicators)) => void;
  load: () => void;
  destroy: () => void;
}

/**
 * Create a shared chart store for Svelte components
 * SVELTE: Uses writable stores, $
 * SHARED: Uses fetchCandles from shared.ts
 */
export function createChartStore(options: {
  initialSymbol?: string;
  initialTimeframe?: (typeof chartTimeframes)[number];
  initialIndicators?: Partial<ChartIndicators>;
} = {}): ChartStore {
  const {
    initialSymbol = DEFAULT_CHART_CONFIG.initialSymbol,
    initialTimeframe = DEFAULT_CHART_CONFIG.initialTimeframe,
    initialIndicators = DEFAULT_INDICATORS,
  } = options;

  const symbol = writable(initialSymbol);
  const timeframe = writable(initialTimeframe);
  const indicators = writable<ChartIndicators>({
    ...DEFAULT_INDICATORS,
    ...initialIndicators,
  });
  const status = writable<"idle" | "loading" | "ready" | "error">("idle");
  const data = writable<ChartData | null>(null);
  const error = writable<Error | null>(null);

  const symbols = chartSymbols as readonly string[];
  const timeframes = [...chartTimeframes] as readonly string[];

  // Load data when symbol or timeframe changes
  let currentReqId = 0;
  const load = async () => {
    const sym = get(symbol);
    const tf = get(timeframe);

    if (!sym || !tf) return;

    const reqId = ++currentReqId;
    status.set("loading");
    error.set(null);
    startChartSwitch();

    const points = calculatePoints(tf);

    try {
      const chartData = await fetchCandles(sym, tf, points);

      if (reqId !== currentReqId) return;

      data.set(chartData);
      markChartReady(sym, tf);
      status.set("ready");
    } catch (e) {
      if (reqId !== currentReqId) return;

      const errorObj = e instanceof Error ? e : new Error(String(e));
      error.set(errorObj);
      markChartError(errorObj);
      status.set("error");
    }
  };

  // Subscribe to symbol and timeframe changes
  symbol.subscribe(() => {
    load();
  });

  timeframe.subscribe(() => {
    load();
  });

  // Load initial data
  load();

  return {
    // Stores
    symbol,
    timeframe,
    indicators,
    status,
    data,
    error,
    // Constants
    symbols,
    timeframes,
    // Actions
    setSymbol: (s: string) => symbol.set(s),
    setTimeframe: (tf: (typeof chartTimeframes)[number]) => timeframe.set(tf),
    setIndicators: (i) => {
      indicators.update((prev: ChartIndicators) => {
        if (typeof i === "function") {
          return i(prev);
        }
        return { ...prev, ...i };
      });
    },
    // Manual load
    load,
    // Cleanup
    destroy: () => {
      currentReqId++;
    },
  };
}
