const CACHE_LIST = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const CACHE_DETAIL = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";

export type BenchCacheKind = "list" | "detail";

export function benchCacheHeader(profile: string | null | undefined, kind: BenchCacheKind) {
  if (profile === "idiomatic" || profile === "mobile-cold") {
    return kind === "detail" ? CACHE_DETAIL : CACHE_LIST;
  }
  return "no-store";
}

export function applyBenchCache(headers: Headers, profile: string | null | undefined, kind: BenchCacheKind) {
  headers.set("cache-control", benchCacheHeader(profile, kind));
}
