<script lang="ts">
  import { formatUsd, type Listing } from "@cf-bench/dataset";
  import type { PageData } from "./$types";

  export let data: PageData;

  let listings = data.listings as Listing[];
</script>

<h1 class="h1">Stays</h1>
<p class="muted">Airbnb-style listing index.</p>

<div class="grid cols-3">
  {#each listings as l (l.id)}
    <a
      class="card"
      data-testid="stay-card"
      href={`/stays/${l.id}`}
      style="padding:14px;display:block"
    >
      <div style="display:flex;justify-content:space-between;gap:12px">
        <div>
          <div style="font-weight:700">{l.title}</div>
          <div class="muted small">
            {l.city}, {l.country} • {l.bedrooms} bd • {l.baths} ba • up to {l.maxGuests} guests
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700">{formatUsd(l.pricePerNight)} <span class="muted small">/ night</span></div>
          <div class="muted small">★ {l.rating} ({l.reviews})</div>
        </div>
      </div>
      <div class="muted small" style="margin-top:10px">{l.summary}</div>
    </a>
  {/each}
</div>
