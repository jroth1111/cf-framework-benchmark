/**
 * Centralized benchmark configuration and constants
 * Shared across all framework implementations
 */

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
 * API endpoint paths
 */
export const API_PATHS = {
  bench: "/api/bench",
  health: "/api/health",
  listings: "/api/listings",
  listingById: (id: string) => `/api/listings/${id}`,
  prices: "/api/prices",
  media: "/api/media",
} as const;

/**
 * Page routes
 */
export const PAGE_ROUTES = {
  home: "/",
  stays: "/stays",
  blog: "/blog",
  chart: "/chart",
  media: "/media",
  blogPost: (slug: string) => `/blog/${slug}`,
  stayDetail: (id: string) => `/stays/${id}`,
} as const;

/**
 * Test data selectors
 */
export const TEST_SELECTORS = {
  symbolSelect: '[data-testid="symbol-select"]',
  timeframeSelect: '[data-testid="timeframe-select"]',
  chartCanvas: '[data-testid="chart-canvas"]',
  mediaCard: '[data-testid="media-card"]',
  mediaPlayer: '[data-testid="media-player"]',
  mediaNext: '[data-testid="media-next"]',
  indicatorSma20: '[data-testid="ind-sma20"]',
  indicatorSma50: '[data-testid="ind-sma50"]',
  indicatorEma20: '[data-testid="ind-ema20"]',
  indicatorVolume: '[data-testid="ind-volume"]',
  stayCard: '[data-testid="stay-card"]',
  blogPostCard: '[data-testid="blog-post-card"]',
  blogHtml: '[data-testid="blog-html"]',
} as const;
