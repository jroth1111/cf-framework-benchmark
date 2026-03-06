import { For } from "solid-js";
import { formatUsd, queryListings } from "@cf-bench/dataset";
import { Layout } from "../components/Layout";

export function Stays() {
  const listings = queryListings({ page: 1, pageSize: 12 }).results;

  return (
    <Layout title="Stays">
      <p class="muted">Airbnb-style listing index rendered by Solid on Workers.</p>

      <div class="grid cols-2">
        <For each={listings}>
          {(listing) => (
            <a
              class="card"
              data-testid="stay-card"
              href={`/stays/${listing.id}`}
              style="padding:14px;display:block"
            >
              <div style="display:flex;justify-content:space-between;gap:12px">
                <div>
                  <div style="font-weight:700">{listing.title}</div>
                  <div class="muted small">
                    {listing.city}, {listing.country} • {listing.bedrooms} bd • {listing.baths} ba • up to {listing.maxGuests} guests
                  </div>
                </div>
                <div style="text-align:right">
                  <div style="font-weight:700">
                    {formatUsd(listing.pricePerNight)} <span class="muted small">/ night</span>
                  </div>
                  <div class="muted small">★ {listing.rating} ({listing.reviews})</div>
                </div>
              </div>
              <div class="muted small" style="margin-top:10px">{listing.summary}</div>
            </a>
          )}
        </For>
      </div>
    </Layout>
  );
}
