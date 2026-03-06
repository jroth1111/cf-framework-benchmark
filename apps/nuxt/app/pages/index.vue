<script setup lang="ts">
import { listings, formatUsd } from "@cf-bench/dataset";

useBenchPage("home");

const featured = listings.slice(0, 6);
</script>

<template>
  <div>
    <h1 class="h1">Cloudflare Framework Benchmark</h1>
    <div class="grid cols-3">
      <div class="card">
        <h2>MPA stays flow</h2>
        <p class="muted">Listing index and detail routes rendered by Nuxt on Workers.</p>
        <p><NuxtLink class="pill" to="/stays">Open stays</NuxtLink></p>
      </div>
      <div class="card">
        <h2>SPA chart flow</h2>
        <p class="muted">Interactive chart controls and canvas measurements.</p>
        <p><NuxtLink class="pill" to="/chart">Open chart</NuxtLink></p>
      </div>
      <div class="card">
        <h2>Media flow</h2>
        <p class="muted">Open and next interactions with benchmark markers.</p>
        <p><NuxtLink class="pill" to="/media">Open media</NuxtLink></p>
      </div>
    </div>

    <h2 style="margin-top: 24px">Featured stays</h2>
    <div class="grid cols-3">
      <NuxtLink v-for="listing in featured" :key="listing.id" class="card" :to="`/stays/${listing.id}`">
        <div style="font-weight: 700">{{ listing.title }}</div>
        <div class="small muted">{{ listing.city }}, {{ listing.country }}</div>
        <div style="margin-top: 8px">
          <strong>{{ formatUsd(listing.pricePerNight) }}</strong> <span class="muted small">/ night</span>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
