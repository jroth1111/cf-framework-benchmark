import { Link } from "react-router-dom";
import { blogPosts } from "@cf-bench/dataset";

export function Blog() {
    return (
        <>
            <h1 className="h1">Blog</h1>
            <p className="muted">SSG-style blog index (static data, bundled at build time).</p>

            <div className="blog-list" style={{ marginTop: 24 }}>
                {blogPosts.map((post) => (
                    <Link
                        key={post.slug}
                        to={`/blog/${post.slug}`}
                        className="card blog-card"
                        data-testid="blog-post-card"
                        style={{ marginBottom: 16, padding: 16 }}
                    >
                        <h2>{post.title}</h2>
                        <p className="muted small">
                            {post.dateISO} • {post.readingMinutes} min read
                        </p>
                        <p className="muted">{post.excerpt}</p>
                        <div className="tags">
                            {post.tags.map((t) => (
                                <span key={t} className="tag">{t}</span>
                            ))}
                        </div>
                    </Link>
                ))}
            </div>
        </>
    );
}
