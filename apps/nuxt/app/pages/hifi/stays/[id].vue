<script setup lang="ts">
import { getListing } from "@cf-bench/dataset";
import { attachHifiBookingForms, getHifiStayDetailParts } from "@cf-bench/hifi-shell";
import { htmlCacheHeader } from "@cf-bench/bench-cache";

const requestHeaders = useRequestHeaders(["x-cf-bench-profile"]);
const profile = requestHeaders["x-cf-bench-profile"] || null;
const cacheControl = useResponseHeader("cache-control");
cacheControl.value = htmlCacheHeader("/hifi/stays/:id", profile);

const route = useRoute();
const listing = getListing(String(route.params.id || ""));
const parts = getHifiStayDetailParts(listing);

useHead({
  title: listing?.title ?? "Stay not found",
  script: [
    { src: "/__bench/sdk/maps.js", async: true },
    { src: "/__bench/sdk/analytics.js", async: true },
  ],
});

onMounted(() => {
  attachHifiBookingForms();
});
</script>

<template>
  <div v-html="parts.body" />
</template>
