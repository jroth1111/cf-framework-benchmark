<script lang="ts">
  import type { BlogPost } from "@cf-bench/dataset";
  export let data: { posts: BlogPost[] };
</script>

<h1 class="h1">Blog</h1>

<div class="grid cols-2">
  {#each data.posts as p}
    <a class="card" data-testid="blog-post-card" href={`/blog/${p.slug}`} style="padding:14px;display:block">
      <div style="font-weight:700">{p.title}</div>
      <div class="muted small">{p.dateISO} • {p.readingMinutes} min read</div>
      <div class="muted small" style="margin-top:10px">{p.excerpt}</div>
    </a>
  {/each}
</div>
