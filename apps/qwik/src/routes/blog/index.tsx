import { component$ } from "@qwik.dev/core";
import type { StaticGenerateHandler } from "@qwik.dev/router";
import { blogPosts } from "@cf-bench/dataset";

export const onStaticGenerate: StaticGenerateHandler = async () => {
  // Generate a single page
  return {
    params: [],
  };
};

export default component$(() => {
  return (
    <>
      <h1 class="h1">Blog</h1>

      <div class="grid cols-2">
        {blogPosts.map((p) => (
          <a class="card" data-testid="blog-post-card" href={`/blog/${p.slug}`} style="padding:14px;display:block">
            <div style="font-weight:700">{p.title}</div>
            <div class="muted small">{p.dateISO} • {p.readingMinutes} min read</div>
            <div class="muted small" style="margin-top:10px">{p.excerpt}</div>
          </a>
        ))}
      </div>
    </>
  );
});
