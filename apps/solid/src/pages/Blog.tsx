import { blogPosts } from "@cf-bench/dataset";
import { Layout } from "../components/Layout";
import { createSignal, onMount, Show, For } from "solid-js";

export function Blog() {
  const [mounted, setMounted] = createSignal(false);

  // Optimize: Show skeleton before mounting
  onMount(() => {
    requestAnimationFrame(() => {
      setMounted(true);
    });
  });

  return (
    <Layout title="Blog">
      <Show when={mounted()} fallback={
        <div class="grid cols-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} class="card" data-testid="blog-post-card" style="padding: 14px;">
              <div class="skeleton" style="height: 32px; width: 70%; margin-bottom: 12px;" />
              <div class="skeleton" style="height: 16px; width: 40%; margin-bottom: 12px;" />
              <div class="skeleton" style="height: 16px; width: 100%;" />
            </div>
          ))}
        </div>
      }>
        <div class="grid cols-2">
          <For each={blogPosts}>
            {(p) => (
              <a class="card" data-testid="blog-post-card" href={`/blog/${p.slug}`} style="padding:14px;display:block">
                <div style="font-weight:700">{p.title}</div>
                <div class="muted small">{p.dateISO} • {p.readingMinutes} min read</div>
                <div class="muted small" style="margin-top:10px">{p.excerpt}</div>
              </a>
            )}
          </For>
        </div>
      </Show>
    </Layout>
  );
}
