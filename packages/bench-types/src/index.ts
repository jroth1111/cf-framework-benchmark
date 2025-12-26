/**
 * Shared TypeScript types for Cloudflare Framework Benchmark
 * Provides type-safe access to window.__CF_BENCH__ metrics
 */

/**
 * Chart-specific metrics captured during benchmark runs
 */
export interface ChartMetrics {
  ready: boolean;
  symbol: string;
  timeframe: string;
  lastRenderTs: number;
  switchDurationMs: number;
  error?: boolean;
  errorMessage?: string;
  switchStartTs?: number;
}

/**
 * Low-level chart rendering performance metrics
 */
export interface ChartCoreMetrics {
  avgDrawTimeMs: number;
  maxDrawTimeMs: number;
  drawCount: number;
  totalDrawTimeMs: number;
}

/**
 * Root benchmark metrics object attached to window
 */
export interface BenchmarkMetrics {
  chart?: ChartMetrics;
  chartCore?: ChartCoreMetrics;
  [key: string]: any;
}

declare global {
  interface Window {
    __CF_BENCH__?: BenchmarkMetrics;
    __CF_BENCH_CONFIG__?: { chartCache?: string };
  }
}

export function getBenchMetrics(): BenchmarkMetrics | null {
  if (typeof window === 'undefined') return null;
  return window.__CF_BENCH__ || null;
}

export function setBenchMetric<K extends keyof BenchmarkMetrics>(
  key: K,
  value: BenchmarkMetrics[K]
): void {
  if (typeof window === 'undefined') return;
  window.__CF_BENCH__ = window.__CF_BENCH__ || {};
  window.__CF_BENCH__[key] = value;
}

export function updateChartMetrics(updates: Partial<ChartMetrics>): void {
  if (typeof window === 'undefined') return;
  window.__CF_BENCH__ = window.__CF_BENCH__ || {};
  window.__CF_BENCH__.chart = {
    ...(window.__CF_BENCH__.chart || {} as ChartMetrics),
    ...updates,
  };
}

export function updateChartCoreMetrics(updates: Partial<ChartCoreMetrics>): void {
  if (typeof window === 'undefined') return;
  window.__CF_BENCH__ = window.__CF_BENCH__ || {};
  window.__CF_BENCH__.chartCore = {
    ...(window.__CF_BENCH__.chartCore || {} as ChartCoreMetrics),
    ...updates,
  };
}

export function startChartSwitch(): void {
  if (typeof window === 'undefined') return;
  window.__CF_BENCH__ = window.__CF_BENCH__ || {};
  window.__CF_BENCH__.chart = {
    ...(window.__CF_BENCH__.chart || {} as ChartMetrics),
    ready: false,
    error: false,
    switchStartTs: performance.now(),
  };
}

export function markChartReady(symbol: string, timeframe: string): void {
  const metrics = getBenchMetrics();
  const switchStartTs = metrics?.chart?.switchStartTs || performance.now();
  const now = performance.now();

  updateChartMetrics({
    ready: true,
    symbol,
    timeframe,
    lastRenderTs: now,
    switchDurationMs: now - switchStartTs,
  });
}

export function markChartError(error: Error | string): void {
  const errorMessage = typeof error === 'string' ? error : error.message;
  updateChartMetrics({
    ready: true,
    error: true,
    errorMessage,
  });
}

export function getChartCacheMode(): 'no-store' | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as any).__CF_BENCH_CONFIG__?.chartCache;
}

export function getChartFetchOptions(): RequestInit | undefined {
  const mode = getChartCacheMode();
  return mode === 'no-store' ? { cache: 'no-store' } : undefined;
}
