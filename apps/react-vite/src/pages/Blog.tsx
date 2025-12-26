import React from "react";
import { blogPosts } from "@cf-bench/dataset";
import { Layout } from "../components/Layout";

export function Blog() {
  return (
    <Layout title="Blog">
      <div className="grid cols-2">
        {blogPosts.map((p) => (
          <a
            key={p.slug}
            className="card"
            data-testid="blog-post-card"
            href={`/blog/${p.slug}`}
            style={{ padding: 14, display: "block" }}
          >
            <div style={{ fontWeight: 700 }}>{p.title}</div>
            <div className="muted small">{p.dateISO} • {p.readingMinutes} min read</div>
            <div className="muted small" style={{ marginTop: 10 }}>{p.excerpt}</div>
          </a>
        ))}
      </div>
    </Layout>
  );
}
