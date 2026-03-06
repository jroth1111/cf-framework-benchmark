import type { Listing, Candle, MediaItem } from "@cf-bench/dataset";

export type JsonOptions = {
  status?: number;
  cacheControl?: string | null;
  headers?: HeadersInit | null;
  start?: number | null;
};

export function json(data: unknown, options?: JsonOptions): Response;
export function parseIntParam(value: string | null, fallback: number): number;

export type BenchResponseV3 = {
  isolateId: string;
  hits: number;
  now: number;
  runtime: "cloudflare-workers";
  framework: string;
  contractVersion: "v3.0.0";
  suiteSupport: string[];
};

export type HealthResponse = {
  ok: true;
  ts: number;
};

export type ListingsResponse = {
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  results: Listing[];
};

export type ListingResponse =
  | { listing: Listing }
  | { error: "not_found" };

export type PricesResponse =
  | { symbol: string; timeframe: string; candles: Candle[] }
  | { error: "unknown_symbol" };

export type MediaResponse = {
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  results: MediaItem[];
};

export function handleBench(framework: string): Response;
export function handleHealth(): Response;
export function handleListings(input: URL | Request | string): Response;
export function handleListing(id: string): Response;
export function handlePrices(input: URL | Request | string): Response;
export function handleMedia(input: URL | Request | string): Response;
export function handleContractApi(framework: string, input: URL | Request | string): Response | null;
