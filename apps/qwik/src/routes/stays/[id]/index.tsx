import { component$ } from "@qwik.dev/core";
import { Link, routeLoader$ } from "@qwik.dev/router";
import { formatUsd, getListing } from "@cf-bench/dataset";
export const useStay = routeLoader$(({ params }) => {
  return { listing: getListing(params.id) };
});

export default component$(() => {
  const { listing } = useStay().value;

  if (!listing) {
    return (
      <>
        <h1 class="h1">Stay not found</h1>
        <div class="card" style="padding:16px">
          <p>Unknown listing.</p>
          <Link class="pill" href="/stays">Back</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 class="h1">{listing.title}</h1>
      <div class="card" style="padding:16px">
        <div class="muted small">
          {listing.city}, {listing.country} • {listing.bedrooms} bd • {listing.baths} ba • up to {listing.maxGuests} guests
        </div>

        <div style="margin-top:10px;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap">
          <div class="pill">★ {listing.rating} <span class="muted">({listing.reviews})</span></div>
          <div class="pill"><strong>{formatUsd(listing.pricePerNight)}</strong> <span class="muted">/ night</span></div>
          <Link class="pill" href="/stays">← Back to results</Link>
        </div>

        <div data-testid="stay-description" style="margin-top:14px" dangerouslySetInnerHTML={listing.descriptionHtml as any} />
      </div>
    </>
  );
});
