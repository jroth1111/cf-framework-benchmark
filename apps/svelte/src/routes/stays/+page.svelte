<script lang="ts">
  import { formatUsd, type Listing } from "@cf-bench/dataset";
  import type { PageData } from "./$types";

  export let data: PageData;

  let city = data.city;
  let maxRaw = data.maxRaw;
  let cities = data.cities;
  let filtered = data.filtered as Listing[];
</script>

<h1 class="h1">Stays</h1>

<form method="get" action="/stays" class="card" style="padding:14px;margin-bottom:14px">
  <div class="grid cols-3">
    <div>
      <div class="small muted">City</div>
      <select class="input" name="city" bind:value={city}>
        <option value="">Any</option>
        {#each cities as c}
          <option value={c}>{c}</option>
        {/each}
      </select>
    </div>

    <div>
      <div class="small muted">Max price</div>
      <input class="input" name="max" bind:value={maxRaw} placeholder="e.g. 250" inputmode="numeric" />
    </div>

    <div style="display:flex;align-items:end">
      <button class="btn" type="submit">Apply</button>
    </div>
  </div>
</form>

<div class="grid cols-2">
  {#each filtered as l (l.id)}
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
