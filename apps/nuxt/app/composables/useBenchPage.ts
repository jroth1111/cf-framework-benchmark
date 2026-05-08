import { htmlCacheHeader } from "@cf-bench/bench-cache";

type BenchPageKind = "home" | "chart" | "media" | "list-stays" | "list-blog" | "detail-stays" | "detail-blog";

const ROUTE_BY_KIND: Record<BenchPageKind, string> = {
  home: "/",
  chart: "/chart",
  media: "/media",
  "list-stays": "/stays",
  "list-blog": "/blog",
  "detail-stays": "/stays/:id",
  "detail-blog": "/blog/:slug",
};

export function useBenchPage(kind: BenchPageKind) {
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

  cacheControl.value = htmlCacheHeader(ROUTE_BY_KIND[kind], profile);
}
