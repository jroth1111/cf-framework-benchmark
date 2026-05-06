import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { queryListings } from "@cf-bench/dataset";
import { renderHifiStaysListBody } from "@cf-bench/hifi-shell";

export const useHifiStays = routeLoader$(({ headers }) => {
  headers.set("cache-control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
  return { listings: queryListings({ page: 1, pageSize: 12 }).results };
});

export default component$(() => {
  const data = useHifiStays().value;
  const html = renderHifiStaysListBody(data.listings);
  return <div dangerouslySetInnerHTML={html} />;
});
