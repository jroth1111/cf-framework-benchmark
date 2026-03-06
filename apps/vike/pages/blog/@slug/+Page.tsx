import { useData } from "vike-react/useData";
import type { Data } from "./+data";

export default function Page() {
  const { post } = useData<Data>();

  if (!post) {
    return (
      <>
        <h1 className="h1">Post not found</h1>
        <a className="pill back-link" href="/blog">
          Back to blog
        </a>
      </>
    );
  }

  return (
    <>
      <a className="pill back-link" href="/blog">
        Back to blog
      </a>
      <article className="card blog-post">
        <h1 className="h1">{post.title}</h1>
        <p className="muted small">
          {post.dateISO} • {post.readingMinutes} min read
        </p>
        <div className="tags" style={{ marginBottom: 16 }}>
          {post.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
        <div data-testid="blog-html" dangerouslySetInnerHTML={{ __html: post.html }} />
      </article>
    </>
  );
}
