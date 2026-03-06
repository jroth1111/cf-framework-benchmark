export declare const CACHE: {
  readonly noStore: "no-store";
  readonly short: "public, max-age=0, s-maxage=60";
  readonly detail: "public, max-age=0, s-maxage=300";
};

export declare function toUrl(
  input: URL | Request | string | { url: string } | null | undefined
): URL;

export declare function withServerTiming(
  headers?: HeadersInit | null,
  start?: number | null
): Headers;

export declare function parseIntParam(value: string | null, fallback: number): number;
export declare function parseIntParam(value: string | null, fallback: undefined): number | undefined;
export declare function parseIntParam(
  value: string | null,
  fallback: number | undefined
): number | undefined;

export declare function esc(value: unknown): string;
