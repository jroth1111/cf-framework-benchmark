<script lang="ts">
  import { formatUsd, type Listing } from "@cf-bench/dataset";
  export let data: { listing: Listing | undefined };
</script>

{#if data.listing}
  <h1 class="h1">{data.listing.title}</h1>

  <div class="card" style="padding:16px">
    <div class="muted small">
      {data.listing.city}, {data.listing.country} • {data.listing.bedrooms} bd • {data.listing.baths} ba • up to {data.listing.maxGuests} guests
    </div>

    <div style="margin-top:10px;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap">
      <div class="pill">★ {data.listing.rating} <span class="muted">({data.listing.reviews})</span></div>
      <div class="pill"><strong>{formatUsd(data.listing.pricePerNight)}</strong> <span class="muted">/ night</span></div>
      <a class="pill" href="/stays">← Back to results</a>
    </div>

    <div data-testid="stay-description" style="margin-top:14px">
      {@html data.listing.descriptionHtml}
    </div>
  </div>
{:else}
  <h1 class="h1">Stay not found</h1>
  <div class="card" style="padding:16px">
    <p>Unknown listing.</p>
    <a class="pill" href="/stays">Back</a>
  </div>
{/if}
