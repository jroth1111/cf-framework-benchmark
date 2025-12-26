/**
 * SHARED logic for chart functionality
 * Framework-agnostic - can be used by React, Solid, Svelte, Qwik, etc.
 */

import { type Candle } from "@cf-bench/dataset";
import { getChartFetchOptions } from "@cf-bench/bench-types";
import { getChartPoints } from "@cf-bench/bench-config";
import type { ChartData, ChartError } from "./types";

/**
 * Fetch chart candles for given symbol and timeframe
 * SHARED - Same implementation for all frameworks
 */
export async function fetchCandles(
  symbol: string,
  timeframe: string,
  points?: number
): Promise<ChartData> {
  const opts = getChartFetchOptions();
  const numPoints = points ?? getChartPoints(timeframe);
  const url = `/api/prices?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&points=${numPoints}`;

  const response = await fetch(url, opts);

  if (!response.ok) {
    const errorText = await response.text();
    const error: ChartError = {
      message: `Failed to fetch candles for ${symbol}/${timeframe}: HTTP ${response.status} - ${errorText}`,
      symbol,
      timeframe,
      status: response.status,
    };
    throw new Error(error.message);
  }

  const data = await response.json();

  if (!data.symbol || !Array.isArray(data.candles)) {
    const error: ChartError = {
      message: `Invalid response format for ${symbol}/${timeframe}: missing symbol or candles array`,
      symbol,
      timeframe,
    };
    throw new Error(error.message);
  }

  return data as ChartData;
}

/**
 * Calculate points for a timeframe
 * SHARED - Same logic for all frameworks
 */
export function calculatePoints(timeframe: string): number {
  return getChartPoints(timeframe);
}

/**
 * Default indicator values
 * SHARED - Same defaults for all frameworks
 */
export const DEFAULT_INDICATORS = {
  sma20: true,
  sma50: false,
  ema20: false,
  volume: true,
} as const;

export type DefaultIndicators = typeof DEFAULT_INDICATORS;
