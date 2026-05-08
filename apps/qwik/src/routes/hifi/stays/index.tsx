import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { queryListings } from "@cf-bench/dataset";
import { renderHifiStaysListBody } from "@cf-bench/hifi-shell";

// cache-control is set by src/entry.cloudflare-pages.tsx (single source: @cf-bench/bench-cache).
export const useHifiStays = routeLoader$(() => {
  return { listings: queryListings({ page: 1, pageSize: 12 }).results };
});

export default component$(() => {
  const data = useHifiStays().value;
  const html = renderHifiStaysListBody(data.listings);
  return <div dangerouslySetInnerHTML={html} />;
});
