<script lang="ts">
  import type { BlogPost } from "@cf-bench/dataset";
  import { onMount } from "svelte";

  export let data: { post: BlogPost | undefined };

  onMount(() => {
    const w = window as any;
    w.__CF_BENCH__ = w.__CF_BENCH__ || {};
    const hydration = (w.__CF_BENCH__.hydration = w.__CF_BENCH__.hydration || {});
    hydration.endMs = performance.now();
  });
</script>

{#if data.post}
  <h1 class="h1">{data.post.title}</h1>
  <div class="muted small">{data.post.dateISO} • {data.post.readingMinutes} min read</div>
  <div class="card" data-testid="blog-html" style="padding:16px;margin-top:14px">
    {@html data.post.html}
  </div>
  <div style="margin-top:14px">
    <a class="pill" href="/blog">← Back to blog</a>
  </div>
{:else}
  <h1 class="h1">Post not found</h1>
  <a class="pill" href="/blog">Back</a>
{/if}
