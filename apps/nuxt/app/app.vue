<template>
  <div>
    <header class="container nav">
      <NuxtLink class="brand" no-prefetch to="/">CF Bench</NuxtLink>
      <nav class="links">
        <NuxtLink class="pill" no-prefetch to="/stays">Stays</NuxtLink>
        <NuxtLink class="pill" no-prefetch to="/chart">Chart</NuxtLink>
        <NuxtLink class="pill" no-prefetch to="/media">Media</NuxtLink>
        <NuxtLink class="pill" no-prefetch to="/blog">Blog</NuxtLink>
      </nav>
    </header>
    <main class="container">
      <NuxtPage />
      <div class="footer">Nuxt variant • Workers SSR pages and Nitro APIs for the benchmark contract.</div>
    </main>
  </div>
</template>

<script setup lang="ts">
useHead({
  script: [
    {
      innerHTML:
        "(function(){var w=window;w.__CF_BENCH__=w.__CF_BENCH__||{};var h=w.__CF_BENCH__.hydration=w.__CF_BENCH__.hydration||{};if(h.startMs==null)h.startMs=performance.now();})();",
    },
  ],
});

onMounted(() => {
  const w = window as any;
  w.__CF_BENCH__ = w.__CF_BENCH__ || {};
  const hydration = (w.__CF_BENCH__.hydration = w.__CF_BENCH__.hydration || {});
  hydration.endMs = performance.now();
});
</script>
