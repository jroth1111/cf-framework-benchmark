import { blogPosts } from '@cf-bench/dataset';

export default async function BlogPage() {
  return (
    <>
      <title>CF Bench Blog</title>
      <section className="hero">
        <p className="eyebrow">Articles</p>
        <h1 className="h1">Blog</h1>
        <p className="muted">Static benchmark posts with shared selectors and dataset values.</p>
      </section>
      <section className="grid cols-2 section">
        {blogPosts.map((post) => (
          <a key={post.slug} className="card blog-card" data-testid="blog-post-card" href={`/blog/${post.slug}`}>
            <strong>{post.title}</strong>
            <p className="muted small">
              {post.dateISO} • {post.readingMinutes} min read
            </p>
            <p className="muted">{post.excerpt}</p>
          </a>
        ))}
      </section>
    </>
  );
}

export const getConfig = async () => ({ render: 'static' } as const);
