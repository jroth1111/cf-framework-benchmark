<script setup lang="ts">
import { formatUsd, queryListings } from "@cf-bench/dataset";

useBenchPage("list");

const route = useRoute();
const page = Number(route.query.page || "1") || 1;
const data = queryListings({ page, pageSize: 12 });
</script>

<template>
  <div>
    <h1 class="h1">Stays</h1>
    <p class="muted">Airbnb-style listing index served by Nuxt SSR on Workers.</p>

    <div class="grid cols-3" style="margin-top: 12px">
      <NuxtLink
        v-for="listing in data.results"
        :key="listing.id"
        :to="`/stays/${listing.id}`"
        data-testid="stay-card"
        class="card"
        no-prefetch
      >
        <div style="font-weight: 700">{{ listing.title }}</div>
        <div class="small muted">
          {{ listing.city }}, {{ listing.country }} • {{ listing.bedrooms }} bd • {{ listing.baths }} ba
        </div>
        <div style="margin-top: 8px">
          <strong>{{ formatUsd(listing.pricePerNight) }}</strong> <span class="muted small">/ night</span>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
