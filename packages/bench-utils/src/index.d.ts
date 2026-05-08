export declare function toUrl(
  input: URL | Request | string | { url: string } | null | undefined
): URL;

export declare function getIsolateId(): string;

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
