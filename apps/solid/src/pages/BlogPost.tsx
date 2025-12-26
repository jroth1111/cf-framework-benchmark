import { getPost } from "@cf-bench/dataset";
import { Layout } from "../components/Layout";

declare global {
  interface Window {
    __PAGE_PROPS__?: { slug?: string };
  }
}

export function BlogPost() {
  const slug = window.__PAGE_PROPS__?.slug ?? "";
  const p = getPost(slug);

  if (!p) {
    return (
      <Layout title="Post not found">
        <p>Unknown post.</p>
        <a class="pill" href="/blog">Back</a>
      </Layout>
    );
  }

  return (
    <Layout title={p.title}>
      <div class="muted small">{p.dateISO} • {p.readingMinutes} min read</div>
      <div class="card" style="padding:16px;margin-top:14px">
        <div data-testid="blog-html" innerHTML={p.html} />
      </div>
      <div style="margin-top:14px">
        <a class="pill" href="/blog">← Back to blog</a>
      </div>
    </Layout>
  );
}
