const CACHE_LIST = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const CACHE_DETAIL = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";

export function useBenchPage(kind: "home" | "chart" | "media" | "list" | "detail") {
  const requestHeaders = useRequestHeaders(["x-cf-bench-profile"]);
  const profile = requestHeaders["x-cf-bench-profile"] || null;
  const cacheControl = useResponseHeader("cache-control");
  const needsClient = kind === "chart" || kind === "media";

  if (!needsClient) {
    useHead({
      script: [
        {
          innerHTML:
            "(function(){var w=window;w.__CF_BENCH__=w.__CF_BENCH__||{};var h=w.__CF_BENCH__.hydration=w.__CF_BENCH__.hydration||{};if(h.endMs==null)h.endMs=h.startMs??performance.now();})();",
        },
      ],
    });
  }

  if (profile === "idiomatic" || profile === "mobile-cold") {
    if (kind === "list") cacheControl.value = CACHE_LIST;
    else if (kind === "detail") cacheControl.value = CACHE_DETAIL;
    else cacheControl.value = "no-store";
  } else {
    cacheControl.value = "no-store";
  }
}
