<script setup lang="ts">
import { blogPosts } from "@cf-bench/dataset";

useBenchPage("list-blog");
</script>

<template>
  <div>
    <h1 class="h1">Blog</h1>
    <div class="grid cols-2">
      <NuxtLink
        v-for="post in blogPosts"
        :key="post.slug"
        :to="`/blog/${post.slug}`"
        data-testid="blog-post-card"
        class="card"
        no-prefetch
      >
        <div style="font-weight: 700">{{ post.title }}</div>
        <div class="small muted">{{ post.dateISO }} • {{ post.readingMinutes }} min read</div>
        <p class="muted">{{ post.excerpt }}</p>
      </NuxtLink>
    </div>
  </div>
</template>
