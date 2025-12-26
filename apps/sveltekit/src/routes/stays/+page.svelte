<script lang="ts">
  import { formatUsd, type Listing, listings } from "@cf-bench/dataset";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  async function navigateToStay(id: string) {
    try {
      console.log(`[SvelteKit] Navigating to /stays/${id}`);
      await goto(`/stays/${id}`, {
        noScroll: true,
        keepFocus: true,
      });
      console.log(`[SvelteKit] Navigation successful`);
    } catch (err) {
      console.error('[SvelteKit] Navigation error:', err);
      // Fallback: use anchor tag navigation
      window.location.href = `/stays/${id}`;
    }
  }

  let city = "";
  let maxRaw = "";
  let mounted = false;

  // Reactive derived state with $:
  $: cities = Array.from(new Set(listings.map((l) => l.city))).sort();

  // Reactive filtering with $:
  $: maxNum = maxRaw ? Number(maxRaw) : null;

  $: filtered = listings.filter((l) => {
    if (city && l.city !== city) return false;
    if (maxNum != null && Number.isFinite(maxNum) && l.pricePerNight > maxNum) return false;
    return true;
  });

  // Defer rendering to next frame
  onMount(() => {
    requestAnimationFrame(() => {
      mounted = true;
    });
  });
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

{#if !mounted}
  <div class="grid cols-2">
    {#each [1, 2, 3, 4, 5, 6] as i}
      <div class="card" style="padding: 14px; min-height: 200px;">
        <div class="skeleton" style="height: 24px; width: 60%; margin-bottom: 12px;" />
        <div class="skeleton" style="height: 16px; width: 40%; margin-bottom: 8px;" />
        <div class="skeleton" style="height: 20px; width: 30%;" />
      </div>
    {/each}
  </div>
{:else}
  <div class="grid cols-2">
    {#each filtered as l (l.id)}
      <div
        class="card"
        data-testid="stay-card"
        style="padding:14px;cursor:pointer;user-select:none;"
        role="button"
        tabindex="0"
        on:click={() => navigateToStay(l.id)}
        on:keydown={(e) => e.key === 'Enter' && navigateToStay(l.id)}
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
      </div>
    {/each}
  </div>
{/if}
