<script lang="ts">
  import { onMount } from "svelte";
  import "../app.css";

  if (typeof window !== "undefined") {
    const w = window as any;
    w.__CF_BENCH__ = w.__CF_BENCH__ || {};
    const hydration = (w.__CF_BENCH__.hydration = w.__CF_BENCH__.hydration || {});
    if (hydration.startMs == null) hydration.startMs = performance.now();
  }

  onMount(() => {
    const w = window as any;
    w.__CF_BENCH__ = w.__CF_BENCH__ || {};
    const hydration = (w.__CF_BENCH__.hydration = w.__CF_BENCH__.hydration || {});
    hydration.endMs = performance.now();
  });
</script>

<header class="container nav">
  <a class="brand" href="/">CF Bench</a>
  <nav class="links">
    <a class="pill" href="/stays">Stays</a>
    <a class="pill" href="/chart">Chart</a>
    <a class="pill" href="/blog">Blog</a>
  </nav>
</header>

<main class="container">
  <slot />
  <div class="footer">
    SvelteKit variant • stays SSR, blog prerender, chart client-side canvas.
  </div>
</main>
