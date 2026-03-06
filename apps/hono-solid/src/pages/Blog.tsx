import { blogPosts } from "@cf-bench/dataset";
import { For } from "solid-js";
import { Layout } from "../components/Layout";

export function Blog() {
  return (
    <Layout title="Blog">
      <div class="grid cols-2">
        <For each={blogPosts}>
          {(post) => (
            <a class="card" data-testid="blog-post-card" href={`/blog/${post.slug}`} style="padding:14px;display:block">
              <div style="font-weight:700">{post.title}</div>
              <div class="muted small">{post.dateISO} • {post.readingMinutes} min read</div>
              <div class="muted small" style="margin-top:10px">{post.excerpt}</div>
            </a>
          )}
        </For>
      </div>
    </Layout>
  );
}
