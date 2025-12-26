import React from "react";
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
        <a className="pill" href="/blog">Back</a>
      </Layout>
    );
  }

  return (
    <Layout title={p.title}>
      <div className="muted small">{p.dateISO} • {p.readingMinutes} min read</div>
      <div className="card" style={{ padding: 16, marginTop: 14 }}>
        <div data-testid="blog-html" dangerouslySetInnerHTML={{ __html: p.html }} />
      </div>
      <div style={{ marginTop: 14 }}>
        <a className="pill" href="/blog">← Back to blog</a>
      </div>
    </Layout>
  );
}
