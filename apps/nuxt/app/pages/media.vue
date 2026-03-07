<script setup lang="ts">
import type { MediaItem } from "@cf-bench/dataset";
import { queryMedia } from "@cf-bench/dataset";

useBenchPage("media");

const { data } = await useAsyncData("bench-media", async () => queryMedia({ pageSize: 12 }));
const items = computed(() => data.value?.results || []);
const selectedIndex = ref(0);
const selected = computed<MediaItem | null>(() => items.value[selectedIndex.value] ?? null);

function ensureBenchMedia() {
  const w = window as any;
  w.__CF_BENCH__ = w.__CF_BENCH__ || {};
  w.__CF_BENCH__.media = w.__CF_BENCH__.media || { ready: false };
  return w.__CF_BENCH__.media;
}

onMounted(() => {
  const media = ensureBenchMedia();
  media.ready = true;
  media.currentId = items.value[0]?.id || null;
});

function openByIndex(index: number) {
  const start = performance.now();
  selectedIndex.value = index;
  requestAnimationFrame(() => {
    const media = ensureBenchMedia();
    media.openDurationMs = performance.now() - start;
    media.ready = true;
    media.currentId = items.value[index]?.id || null;
  });
}

function nextItem() {
  if (!items.value.length) return;
  const start = performance.now();
  const next = (selectedIndex.value + 1) % items.value.length;
  selectedIndex.value = next;
  requestAnimationFrame(() => {
    const media = ensureBenchMedia();
    media.nextDurationMs = performance.now() - start;
    media.ready = true;
    media.currentId = items.value[next]?.id || null;
  });
}
</script>

<template>
  <div>
    <h1 class="h1">Media Feed (SPA-like)</h1>
    <div class="grid cols-2" style="gap: 16px">
      <div class="card" style="padding: 14px">
        <h2 style="margin-top: 0">Feed</h2>
        <div style="display: grid; gap: 10px; max-height: 560px; overflow: auto">
          <button
            v-for="(item, index) in items"
            :key="item.id"
            data-testid="media-card"
            class="card"
            :style="{
              padding: '10px',
              textAlign: 'left',
              background: 'var(--panel)',
              cursor: 'pointer',
              border: index === selectedIndex ? '1px solid var(--text)' : '1px solid var(--border)'
            }"
            @click="openByIndex(index)"
          >
            <div style="font-weight: 600">{{ item.title }}</div>
            <div class="muted small">{{ item.channel }} • {{ item.publishedISO }}</div>
          </button>
        </div>
      </div>

      <div class="card" style="padding: 14px">
        <h2 style="margin-top: 0">Player</h2>
        <div data-testid="media-player" style="min-height: 260px">
          <template v-if="selected">
            <img
              :src="selected.thumbnail"
              :alt="selected.title"
              loading="lazy"
              decoding="async"
              fetchpriority="low"
              style="width: 100%; max-height: 280px; object-fit: cover; border-radius: 10px"
            />
            <h3>{{ selected.title }}</h3>
            <p class="muted small">{{ selected.channel }} • {{ selected.views.toLocaleString() }} views</p>
            <p class="muted">{{ selected.description }}</p>
          </template>
          <p v-else class="muted">Select a media item.</p>
        </div>
        <button data-testid="media-next" class="btn" :disabled="!items.length" @click="nextItem">Next</button>
      </div>
    </div>
  </div>
</template>
