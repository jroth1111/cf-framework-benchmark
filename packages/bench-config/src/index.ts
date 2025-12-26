/**
 * Centralized benchmark configuration and constants
 * Shared across all framework implementations
 */

/**
 * Time intervals for benchmark measurements
 */
export const BENCHMARK_TIMING = {
  CHART_READY_POLL_MS: 100,
  INTERACTION_SETTLE_MS: 150,
  CONTROL_CHANGE_MS: 250,
  WARMUP_SETTLE_MS: 500,
  LCP_STABLE_WINDOW_MS: 1000,
  LCP_MAX_WAIT_MS: 5000,
  HYDRATION_MAX_WAIT_MS: 2000,
  POST_LOAD_SETTLE_MS: 500,
  CLIENT_NAV_TIMEOUT_MS: 12000,
  SCENARIO_WAIT_TIMEOUT_MS: 12000,
  SCENARIO_HARD_TIMEOUT_MS: 60000,
  CDP_TIMEOUT_MS: 5000,
  INP_SETTLE_MS: 1500,
} as const;

/**
 * Navigation retry configuration
 */
export const NAV_RETRY = {
  maxAttempts: 3,
  backoffMs: 750,
} as const;

/**
 * Viewport dimensions for benchmark runs
 */
export const VIEWPORT = {
  width: 1280,
  height: 720,
} as const;

/**
 * Chart timeframes and their corresponding point counts
 */
export const CHART_POINTS_BY_TIMEFRAME: Record<string, number> = {
  "1m": 900,
  "5m": 700,
  "15m": 520,
  "1h": 360,
} as const;

/**
 * Default chart configuration
 */
export const DEFAULT_CHART_CONFIG = {
  initialSymbol: "BTC",
  initialTimeframe: "1h" as const,
  initialViewport: 180,
  indicators: {
    sma20: true,
    sma50: false,
    ema20: false,
    volume: true,
  },
} as const;

/**
 * Get number of chart points for a given timeframe
 * Falls back to default (1h) if timeframe not found
 */
export function getChartPoints(timeframe: string): number {
  return CHART_POINTS_BY_TIMEFRAME[timeframe] ?? CHART_POINTS_BY_TIMEFRAME["1h"];
}

/**
 * Benchmark profiles and their settings
 */
export const BENCHMARK_PROFILES = {
  parity: {
    chartCache: "no-store" as const,
    throttling: "none" as const,
  },
  idiomatic: {
    chartCache: "default" as const,
    throttling: "none" as const,
  },
  "mobile-cold": {
    chartCache: "default" as const,
    throttling: "fast-4g" as const,
  },
} as const;

/**
 * Network throttling profiles
 */
export const NETWORK_PROFILES = {
  none: {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
    connectionType: "none" as const,
  },
  "fast-4g": {
    offline: false,
    latency: 150,
    downloadThroughput: Math.floor((1.6 * 1024 * 1024) / 8),
    uploadThroughput: Math.floor((0.75 * 1024 * 1024) / 8),
    connectionType: "cellular4g" as const,
  },
  "slow-3g": {
    offline: false,
    latency: 400,
    downloadThroughput: Math.floor((0.4 * 1024 * 1024) / 8),
    uploadThroughput: Math.floor((0.4 * 1024 * 1024) / 8),
    connectionType: "cellular3g" as const,
  },
} as const;

/**
 * API endpoint paths
 */
export const API_PATHS = {
  bench: "/api/bench",
  health: "/api/health",
  listings: "/api/listings",
  listingById: (id: string) => `/api/listings/${id}`,
  prices: "/api/prices",
} as const;

/**
 * Page routes
 */
export const PAGE_ROUTES = {
  home: "/",
  stays: "/stays",
  blog: "/blog",
  chart: "/chart",
  blogPost: (slug: string) => `/blog/${slug}`,
  stayDetail: (id: string) => `/stays/${id}`,
} as const;

/**
 * Cache control directives
 */
export const CACHE_CONTROL = {
  noStore: "no-store",
  publicShort: "public, max-age=0, s-maxage=60",
  publicLong: "public, max-age=300, s-maxage=300",
  publicExtended: "public, max-age=3600, s-maxage=300",
} as const;

/**
 * Test data selectors
 */
export const TEST_SELECTORS = {
  symbolSelect: '[data-testid="symbol-select"]',
  timeframeSelect: '[data-testid="timeframe-select"]',
  chartCanvas: '[data-testid="chart-canvas"]',
  indicatorSma20: '[data-testid="ind-sma20"]',
  indicatorSma50: '[data-testid="ind-sma50"]',
  indicatorEma20: '[data-testid="ind-ema20"]',
  indicatorVolume: '[data-testid="ind-volume"]',
  stayCard: '[data-testid="stay-card"]',
  blogPostCard: '[data-testid="blog-post-card"]',
  blogHtml: '[data-testid="blog-html"]',
} as const;
