import { Link, createFileRoute } from "@tanstack/react-router";
import { blogPosts } from "@cf-bench/dataset";

export const Route = createFileRoute("/blog/")({
  component: Blog,
});

function Blog() {
  return (
    <>
      <h1 className="h1">Blog</h1>
      <div className="grid cols-2">
        {blogPosts.map((p) => (
          <Link
            key={p.slug}
            className="card"
            data-testid="blog-post-card"
            to={`/blog/${p.slug}`}
            style={{ padding: 14, display: "block" }}
          >
            <div style={{ fontWeight: 700 }}>{p.title}</div>
            <div className="muted small">{p.dateISO} • {p.readingMinutes} min read</div>
            <div className="muted small" style={{ marginTop: 10 }}>{p.excerpt}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
