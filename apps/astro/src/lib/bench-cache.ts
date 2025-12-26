const CACHE_LIST = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const CACHE_DETAIL = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";

export type BenchCacheKind = "list" | "detail";

export function applyBenchCache(headers: Headers, profile: string | null | undefined, kind: BenchCacheKind) {
  if (profile === "idiomatic" || profile === "mobile-cold") {
    headers.set("cache-control", kind === "detail" ? CACHE_DETAIL : CACHE_LIST);
    return;
  }
  if (profile === "parity") {
    headers.set("cache-control", "no-store");
  }
}
