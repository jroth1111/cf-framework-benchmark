const CACHE_LIST = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const CACHE_DETAIL = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";
const CACHE_HIFI_LIST = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const CACHE_HIFI_DETAIL = "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";

export type BenchCacheKind = "list" | "detail" | "hifi-list" | "hifi-detail";

export function benchCacheHeader(profile: string | null | undefined, kind: BenchCacheKind) {
  if (profile === "idiomatic" || profile === "mobile-cold") {
    if (kind === "hifi-detail") return CACHE_HIFI_DETAIL;
    if (kind === "hifi-list") return CACHE_HIFI_LIST;
    return kind === "detail" ? CACHE_DETAIL : CACHE_LIST;
  }
  return "no-store";
}

export function applyBenchCache(headers: Headers, profile: string | null | undefined, kind: BenchCacheKind) {
  headers.set("cache-control", benchCacheHeader(profile, kind));
}
