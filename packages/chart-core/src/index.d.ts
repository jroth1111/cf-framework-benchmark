import type { Candle } from '@cf-bench/dataset';

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export type ChartIndicators = {
  sma20: boolean;
  sma50: boolean;
  ema20: boolean;
  volume: boolean;
};

export type ChartTheme = {
  background: string;
  panel: string;
  grid: string;
  text: string;
  mutedText: string;
  up: string;
  down: string;
  upFill: string;
  downFill: string;
  indicator1: string;
  indicator2: string;
  indicator3: string;
  crosshair: string;
  volume: string;
};

export type ChartStats = {
  lastDrawMs: number;
  drawCount: number;
  lastRenderTs: number;
  viewportStart: number;
  viewportEnd: number;
  pointCount: number;
  indicatorCount: number;
};

export type ChartOptions = {
  theme?: Partial<ChartTheme>;
  devicePixelRatio?: number;
  initialViewport?: number;
  onStats?: (stats: ChartStats) => void;
};

export type ChartInstance = {
  setCandles(candles: Candle[]): void;
  setIndicators(indicators: Partial<ChartIndicators>): void;
  setViewport(endIndex: number, count: number): void;
  resize(): void;
  destroy(): void;
  getStats(): ChartStats;
};

export function defaultTheme(): ChartTheme;
export function createChart(canvas: HTMLCanvasElement, opts?: ChartOptions): ChartInstance;
