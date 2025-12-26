/**
 * SHARED types for chart functionality
 * Used across all framework implementations
 */

import { type Candle } from "@cf-bench/dataset";

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

export interface ChartError {
  message: string;
  symbol?: string;
  timeframe?: string;
  status?: number;
}
