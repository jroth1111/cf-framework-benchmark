<script lang="ts">
  import type { MediaItem } from "@cf-bench/dataset";
  import type { PageData } from "./$types";

  export let data: PageData;

  let items: MediaItem[] = data.items;
  let selectedIndex = 0;
  let status: "loading" | "ready" | "error" = data.items.length ? "ready" : "loading";

  function ensureBenchMedia() {
    const w = window as any;
    w.__CF_BENCH__ = w.__CF_BENCH__ || {};
    w.__CF_BENCH__.media = w.__CF_BENCH__.media || { ready: false };
    return w.__CF_BENCH__.media;
  }

  if (typeof window !== "undefined") {
    queueMicrotask(() => {
      const media = ensureBenchMedia();
      media.ready = true;
      media.currentId = items[0]?.id || null;
    });
  }

  function openByIndex(index: number) {
    const start = performance.now();
    selectedIndex = index;
    requestAnimationFrame(() => {
      const media = ensureBenchMedia();
      media.openDurationMs = performance.now() - start;
      media.ready = true;
      media.currentId = items[index]?.id || null;
    });
  }

  function nextItem() {
    if (!items.length) return;
    const start = performance.now();
    selectedIndex = (selectedIndex + 1) % items.length;
    requestAnimationFrame(() => {
      const media = ensureBenchMedia();
      media.nextDurationMs = performance.now() - start;
      media.ready = true;
      media.currentId = items[selectedIndex]?.id || null;
    });
  }

  $: selected = items[selectedIndex];
</script>

<h1 class="h1">Media Feed (SPA-like)</h1>

<div class="grid cols-2" style="gap:16px">
  <div class="card" style="padding:14px">
    <h2 style="margin-top:0">Feed</h2>
    {#if status === "loading"}
      <p class="muted">Loading media…</p>
    {/if}
    {#if status === "error"}
      <p class="muted">Failed to load media.</p>
    {/if}

    <div style="display:grid;gap:10px;max-height:560px;overflow:auto">
      {#each items as item, idx}
        <button
          data-testid="media-card"
          class="card"
          style="padding:10px;text-align:left;background:var(--panel);cursor:pointer;border:{idx === selectedIndex ? '1px solid var(--text)' : '1px solid var(--border)'}"
          on:click={() => openByIndex(idx)}
        >
          <div style="font-weight:600">{item.title}</div>
          <div class="muted small">{item.channel} • {item.publishedISO}</div>
        </button>
      {/each}
      {#if !items.length}
        <div class="muted">No media available.</div>
      {/if}
    </div>
  </div>

  <div class="card" style="padding:14px">
    <h2 style="margin-top:0">Player</h2>
    <div data-testid="media-player" style="min-height:260px">
      {#if selected}
        <img
          src={selected.thumbnail}
          alt={selected.title}
          loading="eager"
          decoding="async"
          fetchpriority="high"
          style="width:100%;max-height:280px;object-fit:cover;border-radius:10px"
        />
        <h3>{selected.title}</h3>
        <p class="muted small">{selected.channel} • {selected.views.toLocaleString()} views</p>
        <p class="muted">{selected.description}</p>
      {:else}
        <p class="muted">Select a media item.</p>
      {/if}
    </div>

    <button data-testid="media-next" class="btn" on:click={nextItem} disabled={!items.length}>Next</button>
  </div>
</div>
