import { Link } from "react-router";
import { blogPosts } from "../lib/data";

export function shouldRevalidate() {
  return false;
}

export default function BlogRoute() {
  return (
    <>
      <h1 className="h1">Blog</h1>
      <div className="grid cols-2">
        {blogPosts.map((post) => (
          <Link
            key={post.slug}
            to={`/blog/${post.slug}`}
            data-testid="blog-post-card"
            className="card"
          >
            <div style={{ fontWeight: 700 }}>{post.title}</div>
            <div className="small muted">
              {post.dateISO} • {post.readingMinutes} min read
            </div>
            <p className="muted">{post.excerpt}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
