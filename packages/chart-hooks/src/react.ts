/**
 * React hooks for chart functionality
 * Uses SHARED data fetching from shared.ts
 * Framework-specific: useState, useEffect, etc.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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

export interface UseChartOptions {
  initialSymbol?: string;
  initialTimeframe?: (typeof chartTimeframes)[number];
  initialIndicators?: Partial<ChartIndicators>;
}

export interface UseChartReturn {
  symbol: string;
  timeframe: string;
  indicators: ChartIndicators;
  status: "idle" | "loading" | "ready" | "error";
  data: ChartData | null;
  error: Error | null;
  setSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: (typeof chartTimeframes)[number]) => void;
  setIndicators: (indicators: Partial<ChartIndicators> | ((prev: ChartIndicators) => ChartIndicators)) => void;
  symbols: string[];
  timeframes: string[];
}

/**
 * React-specific hook for chart functionality
 * REACT: Uses useState, useEffect, useCallback
 * SHARED: Uses fetchCandles from shared.ts
 */
export function useChart(options: UseChartOptions = {}): UseChartReturn {
  const {
    initialSymbol = DEFAULT_CHART_CONFIG.initialSymbol,
    initialTimeframe = DEFAULT_CHART_CONFIG.initialTimeframe,
    initialIndicators = DEFAULT_CHART_CONFIG.indicators,
  } = options;

  const [symbol, setSymbol] = useState(initialSymbol);
  const [timeframe, setTimeframe] = useState(initialTimeframe);
  const [indicators, setIndicators] = useState<ChartIndicators>({
    sma20: true,
    sma50: false,
    ema20: false,
    volume: true,
    ...initialIndicators,
  });
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [data, setData] = useState<ChartData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [cancellationSignal, setCancellationSignal] = useState<AbortController | null>(null);

  const symbols = useMemo(() => [...chartSymbols], []);
  const timeframes = useMemo(() => [...chartTimeframes], []);

  const loadData = useCallback(async () => {
    setStatus("loading");
    setError(null);

    // Cancel any in-flight request
    if (cancellationSignal) {
      cancellationSignal.abort();
    }

    const controller = new AbortController();
    setCancellationSignal(controller);

    startChartSwitch();

    const points = calculatePoints(timeframe);

    try {
      const chartData = await fetchCandles(symbol, timeframe, points);

      if (controller.signal.aborted) return;

      setData(chartData);
      markChartReady(symbol, timeframe);
      setStatus("ready");
    } catch (e) {
      if (controller.signal.aborted) return;

      const errorObj = e instanceof Error ? e : new Error(String(e));
      setError(errorObj);
      markChartError(errorObj);
      setStatus("error");
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    loadData();
  }, [symbol, timeframe]);

  // Handle indicator changes without full data reload
  useEffect(() => {
    if (status === "ready" && data) {
      // Chart will be updated by parent component using indicators state
      markChartReady(symbol, timeframe);
    }
  }, [indicators]);

  const handleSetSymbol = useCallback((newSymbol: string) => {
    setSymbol(newSymbol);
  }, []);

  const handleSetTimeframe = useCallback((newTimeframe: (typeof chartTimeframes)[number]) => {
    setTimeframe(newTimeframe);
  }, []);

  const handleSetIndicators = useCallback(
    (newIndicators: Partial<ChartIndicators> | ((prev: ChartIndicators) => ChartIndicators)) => {
      setIndicators((prev) => {
        if (typeof newIndicators === "function") {
          return newIndicators(prev);
        }
        return { ...prev, ...newIndicators };
      });
    },
    []
  );

  return {
    symbol,
    timeframe,
    indicators,
    status,
    data,
    error,
    setSymbol: handleSetSymbol,
    setTimeframe: handleSetTimeframe,
    setIndicators: handleSetIndicators,
    symbols,
    timeframes,
  };
}
