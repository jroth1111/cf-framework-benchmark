import { blogPosts } from "../../../src/bench";

export default function Page() {
  return (
    <>
      <h1 className="h1">Blog</h1>
      <p className="muted">Static benchmark content rendered to raw HTML by Vike.</p>
      <div className="grid cols-2">
        {blogPosts.map((post) => (
          <a key={post.slug} href={`/blog/${post.slug}`} className="card blog-card" data-testid="blog-post-card">
            <h2>{post.title}</h2>
            <p className="muted small">
              {post.dateISO} • {post.readingMinutes} min read
            </p>
            <p className="muted">{post.excerpt}</p>
            <div className="tags">
              {post.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
