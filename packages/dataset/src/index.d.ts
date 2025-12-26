export type Review = {
  name: string;
  dateISO: string;
  rating: number;
  text: string;
};

export type Listing = {
  id: string;
  title: string;
  city: string;
  country: string;
  neighborhood: string;
  lat: number;
  lng: number;
  pricePerNight: number;
  cleaningFee: number;
  serviceFee: number;
  rating: number;
  reviews: number;
  reviewSamples: Review[];
  maxGuests: number;
  bedrooms: number;
  baths: number;
  tags: string[];
  amenities: string[];
  hostName: string;
  hostSinceISO: string;
  superhost: boolean;
  summary: string;
  descriptionHtml: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  dateISO: string;
  readingMinutes: number;
  excerpt: string;
  tags: string[];
  html: string;
};

export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

export const listings: Listing[];
export function getListing(id: string): Listing | undefined;

export function queryListings(params?: {
  city?: string;
  max?: number;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'rating_desc';
  page?: number;
  pageSize?: number;
}): {
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  results: Listing[];
};

export const blogPosts: BlogPost[];
export function getPost(slug: string): BlogPost | undefined;

export const chartSymbols: string[];
export const chartTimeframes: readonly ['1m', '5m', '15m', '1h', '4h', '1d'];
export function timeframeToMs(tf: string): number;
export function generateCandles(symbol: string, opts?: { points?: number; startPrice?: number; timeframe?: string }): Candle[];

export function formatUsd(value: number): string;
