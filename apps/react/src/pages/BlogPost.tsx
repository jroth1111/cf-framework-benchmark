import { useParams, Link } from "react-router-dom";
import { getPost } from "@cf-bench/dataset";

export function BlogPost() {
    const { slug } = useParams<{ slug: string }>();
    const post = slug ? getPost(slug) : null;

    if (!post) {
        return (
            <>
                <h1 className="h1">Post not found</h1>
                <Link to="/blog" className="pill">← Back to blog</Link>
            </>
        );
    }

    return (
        <>
            <Link to="/blog" className="pill" style={{ marginBottom: 16 }}>
                ← Back to blog
            </Link>

            <article className="blog-post">
                <h1 className="h1">{post.title}</h1>
                <p className="muted">
                    {post.dateISO} • {post.readingMinutes} min read
                </p>
                <div className="tags" style={{ marginBottom: 24 }}>
                    {post.tags.map((t) => (
                        <span key={t} className="tag">{t}</span>
                    ))}
                </div>
                <div data-testid="blog-html" dangerouslySetInnerHTML={{ __html: post.html }} />
            </article>
        </>
    );
}
