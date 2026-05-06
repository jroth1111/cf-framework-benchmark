import { component$, useVisibleTask$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import { getListing } from "@cf-bench/dataset";
import { attachHifiBookingForms, renderHifiStayDetailBody } from "@cf-bench/hifi-shell";

export const useHifiStay = routeLoader$(({ params, headers }) => {
  headers.set("cache-control", "public, max-age=0, s-maxage=300, stale-while-revalidate=86400");
  return { listing: getListing(params.id) };
});

export default component$(() => {
  const { listing } = useHifiStay().value;

  useVisibleTask$(() => {
    attachHifiBookingForms();
  });

  if (!listing) {
    return (
      <>
        <h1 class="h1">Stay not found</h1>
        <div class="card" style="padding:16px">
          <p>Unknown listing.</p>
          <a class="pill" href="/hifi/stays">Back</a>
        </div>
      </>
    );
  }

  const html = renderHifiStayDetailBody(listing);
  return <div dangerouslySetInnerHTML={html} />;
});
