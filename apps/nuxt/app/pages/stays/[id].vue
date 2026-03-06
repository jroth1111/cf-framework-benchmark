<script setup lang="ts">
import { getListing, formatUsd } from "@cf-bench/dataset";

useBenchPage("detail");

const route = useRoute();
const listing = getListing(String(route.params.id || ""));

if (!listing) {
  throw createError({ statusCode: 404, statusMessage: "Listing not found" });
}
</script>

<template>
  <div>
    <NuxtLink class="pill" to="/stays">← Back to stays</NuxtLink>
    <h1 class="h1">{{ listing.title }}</h1>
    <div class="small muted">{{ listing.city }}, {{ listing.country }} • {{ listing.neighborhood }}</div>
    <div class="card" style="margin-top: 12px">
      <div style="margin-bottom: 12px">
        <strong>{{ formatUsd(listing.pricePerNight) }}</strong> <span class="muted small">/ night</span>
      </div>
      <div data-testid="stay-description" v-html="listing.descriptionHtml" />
    </div>
  </div>
</template>
