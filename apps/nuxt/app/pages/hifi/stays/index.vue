<script setup lang="ts">
import { queryListings } from "@cf-bench/dataset";
import { renderHifiStaysListBody } from "@cf-bench/hifi-shell";
import { htmlCacheHeader } from "@cf-bench/bench-cache";

const requestHeaders = useRequestHeaders(["x-cf-bench-profile"]);
const profile = requestHeaders["x-cf-bench-profile"] || null;
const cacheControl = useResponseHeader("cache-control");
cacheControl.value = htmlCacheHeader("/hifi/stays", profile);

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
