/**
 * SolidJS signals for chart functionality
 * Uses SHARED data fetching from shared.ts
 * Framework-specific: createSignal, createEffect, etc.
 */

import { createSignal, createEffect, type Signal } from "solid-js";
import { chartSymbols, chartTimeframes } from "@cf-bench/dataset";
import {
  startChartSwitch,
  markChartReady,
  markChartError,
  updateChartCoreMetrics,
} from "@cf-bench/bench-types";
import { DEFAULT_CHART_CONFIG } from "@cf-bench/bench-config";
import { fetchCandles, calculatePoints } from "./shared";
import type { ChartIndicators, ChartData } from "./types";

export interface UseChartReturn {
  symbol: () => string;
  setSymbol: (s: string) => void;
  timeframe: () => (typeof chartTimeframes)[number];
  setTimeframe: (tf: (typeof chartTimeframes)[number]) => void;
  indicators: () => ChartIndicators;
  setIndicators: (i: Partial<ChartIndicators> | ((prev: ChartIndicators) => ChartIndicators)) => void;
  status: () => "idle" | "loading" | "ready" | "error";
  setStatus: (s: "idle" | "loading" | "ready" | "error") => void;
  data: () => ChartData | null;
  setData: (d: ChartData | null) => void;
  error: () => Error | null;
  setError: (e: Error | null) => void;
  symbols: readonly string[];
  timeframes: readonly string[];
}

/**
 * SolidJS-specific hook for chart functionality
 * SOLID: Uses createSignal, createEffect
 * SHARED: Uses fetchCandles from shared.ts
 */
export function useChart(options: {
  initialSymbol?: string;
  initialTimeframe?: (typeof chartTimeframes)[number];
  initialIndicators?: Partial<ChartIndicators>;
} = {}): UseChartReturn {
  const {
    initialSymbol = DEFAULT_CHART_CONFIG.initialSymbol,
    initialTimeframe = DEFAULT_CHART_CONFIG.initialTimeframe,
    initialIndicators = DEFAULT_CHART_CONFIG.indicators,
  } = options;

  const [symbol, setSymbol] = createSignal(initialSymbol);
  const [timeframe, setTimeframe] = createSignal(initialTimeframe);
  const [indicators, setIndicators] = createSignal<ChartIndicators>({
    sma20: true,
    sma50: false,
    ema20: false,
    volume: true,
    ...initialIndicators,
  });
  const [status, setStatus] = createSignal<"idle" | "loading" | "ready" | "error">("idle");
  const [data, setData] = createSignal<ChartData | null>(null);
  const [error, setError] = createSignal<Error | null>(null);

  const symbols = chartSymbols as readonly string[];
  const timeframes = [...chartTimeframes] as readonly string[];

  // Load data when symbol or timeframe changes
  createEffect(async () => {
    const sym = symbol();
    const tf = timeframe();

    if (!sym || !tf) return;

    setStatus("loading");
    setError(null);
    startChartSwitch();

    const points = calculatePoints(tf);

    try {
      const chartData = await fetchCandles(sym, tf, points);
      setData(chartData);
      markChartReady(sym, tf);
      setStatus("ready");
    } catch (e) {
      const errorObj = e instanceof Error ? e : new Error(String(e));
      setError(errorObj);
      markChartError(errorObj);
      setStatus("error");
    }
  });

  return {
    symbol,
    setSymbol,
    timeframe,
    setTimeframe,
    indicators,
    setIndicators: (i) => {
      if (typeof i === "function") {
        setIndicators(i(indicators()));
      } else {
        setIndicators((prev) => ({ ...prev, ...i }));
      }
    },
    status,
    setStatus,
    data,
    setData,
    error,
    setError,
    symbols,
    timeframes,
  };
}
