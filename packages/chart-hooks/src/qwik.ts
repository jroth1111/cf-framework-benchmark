/**
 * Qwik utilities for chart functionality
 * Uses SHARED data fetching from shared.ts
 * Framework-specific: useSignal, useVisibleTask$
 */

import { chartSymbols, chartTimeframes } from "@cf-bench/dataset";
import {
  updateChartCoreMetrics,
} from "@cf-bench/bench-types";
import { DEFAULT_CHART_CONFIG } from "@cf-bench/bench-config";
import { fetchCandles, calculatePoints, DEFAULT_INDICATORS } from "./shared";
import type { ChartIndicators, ChartData } from "./types";

export interface UseChartQwikReturn {
  symbol: { value: string };
  timeframe: { value: (typeof chartTimeframes)[number] };
  indicators: { value: ChartIndicators };
  status: { value: "idle" | "loading" | "ready" | "error" };
  data: { value: ChartData | null };
  error: { value: Error | null };
  symbols: readonly string[];
  timeframes: readonly string[];
  fetchCandles: typeof fetchCandles;
  updateChartCoreMetrics: typeof updateChartCoreMetrics;
  getChartPoints: typeof calculatePoints;
}

// Lazy import Qwik dependencies to avoid Node.js built-in issues in Next.js builds
let QwikCore: any = null;

function getQwikCore() {
  if (!QwikCore) {
    try {
      QwikCore = require("@qwik.dev/core");
    } catch (e) {
      throw new Error("Qwik not available in this environment");
    }
  }
  return QwikCore;
}

/**
 * Qwik-specific utilities for chart functionality
 * QWIK: Uses useSignal
 * SHARED: Uses fetchCandles from shared.ts
 */
export function useChartQwik(): UseChartQwikReturn {
  const { useSignal } = getQwikCore();
  
  const symbol = useSignal(DEFAULT_CHART_CONFIG.initialSymbol);
  const timeframe = useSignal<(typeof chartTimeframes)[number]>(
    DEFAULT_CHART_CONFIG.initialTimeframe
  );
  const indicators = useSignal<ChartIndicators>({
    ...DEFAULT_INDICATORS,
    ...DEFAULT_CHART_CONFIG.indicators,
  });
  const status = useSignal<"idle" | "loading" | "ready" | "error">("idle");
  const data = useSignal<ChartData | null>(null);
  const error = useSignal<Error | null>(null);

  const symbols = chartSymbols as readonly string[];
  const timeframes = [...chartTimeframes] as readonly string[];

  return {
    symbol,
    timeframe,
    indicators,
    status,
    data,
    error,
    symbols,
    timeframes,
    fetchCandles,
    updateChartCoreMetrics,
    getChartPoints: calculatePoints,
  };
}
