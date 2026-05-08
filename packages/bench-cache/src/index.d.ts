export const NO_STORE: "no-store";
export const SDK_CACHE_HEADER: string;

export function htmlCacheHeader(routeId: string, profile?: string | null): string;
export function apiCacheHeader(routeId: string): string;
export function errorApiCacheHeader(routeId?: string | null): string;

export function classifyHtmlRoute(pathname: string): string | null;
export function htmlCacheHeaderForPath(pathname: string, profile?: string | null): string;

export function htmlCacheHeaderTable(): Record<string, string>;
