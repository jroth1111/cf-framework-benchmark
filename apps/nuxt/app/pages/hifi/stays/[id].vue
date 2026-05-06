<script setup lang="ts">
import { getListing } from "@cf-bench/dataset";
import { attachHifiBookingForms, getHifiStayDetailParts } from "@cf-bench/hifi-shell";

const cacheControl = useResponseHeader("cache-control");
cacheControl.value = "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";

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
