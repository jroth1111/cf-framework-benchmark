<script setup lang="ts">
import { queryListings } from "@cf-bench/dataset";
import { renderHifiStaysListBody } from "@cf-bench/hifi-shell";

const cacheControl = useResponseHeader("cache-control");
cacheControl.value = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

useHead({
  title: "Stays (hifi)",
  script: [
    { src: "/__bench/sdk/maps.js", async: true },
    { src: "/__bench/sdk/analytics.js", async: true },
  ],
});

const listings = queryListings({ page: 1, pageSize: 12 }).results;
const bodyHtml = renderHifiStaysListBody(listings);
</script>

<template>
  <div v-html="bodyHtml" />
</template>
