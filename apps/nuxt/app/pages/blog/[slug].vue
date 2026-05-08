<script setup lang="ts">
import { getPost } from "@cf-bench/dataset";

useBenchPage("detail-blog");

const route = useRoute();
const post = getPost(String(route.params.slug || ""));

if (!post) {
  throw createError({ statusCode: 404, statusMessage: "Post not found" });
}
</script>

<template>
  <div>
    <NuxtLink class="pill" no-prefetch to="/blog">← Back to blog</NuxtLink>
    <h1 class="h1">{{ post.title }}</h1>
    <div class="small muted">{{ post.dateISO }} • {{ post.readingMinutes }} min read</div>
    <div class="card" style="margin-top: 12px">
      <div data-testid="blog-html" v-html="post.html" />
    </div>
  </div>
</template>
