/**
 * Chart hooks package
 * Exports framework-specific and shared utilities
 */

// Shared types and logic - Always available
export type {
  ChartIndicators,
  ChartData,
  ChartError,
} from "./types";
export type { DefaultIndicators } from "./shared";

export {
  fetchCandles,
  calculatePoints,
  DEFAULT_INDICATORS,
} from "./shared";

// Framework-specific hooks - Each app imports what it needs
// Note: These are optional peer dependencies

// React
export type { UseChartOptions, UseChartReturn } from "./react";
export { useChart } from "./react";

// Solid
export type { UseChartReturn as UseChartSolidReturn } from "./solid";
export { useChart as useChartSolid } from "./solid";

// Svelte
export type { ChartStore } from "./svelte";
export { createChartStore } from "./svelte";

// Qwik - Exported separately via qwik-hook.ts to avoid build issues in other frameworks
// export type { UseChartQwikReturn } from "./qwik-hook";
// export { useChartQwik } from "./qwik-hook";
