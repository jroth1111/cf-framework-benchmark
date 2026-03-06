import { blogPosts, getPost } from '@cf-bench/dataset';
import type { PageProps } from 'waku/router';

export default async function BlogPostPage({ slug }: PageProps<'/blog/[slug]'>) {
  const post = getPost(slug);

  if (!post) {
    return (
      <>
        <title>Post not found</title>
        <h1 className="h1">Post not found</h1>
        <a className="pill section" href="/blog">
          Back to blog
        </a>
      </>
    );
  }

  return (
    <>
      <title>{post.title}</title>
      <a className="pill" href="/blog">
        Back to blog
      </a>
      <section className="hero section">
        <p className="eyebrow">Blog post</p>
        <h1 className="h1">{post.title}</h1>
        <p className="muted small">
          {post.dateISO} • {post.readingMinutes} min read
        </p>
      </section>
      <article className="card">
        <div data-testid="blog-html" dangerouslySetInnerHTML={{ __html: post.html }} />
      </article>
    </>
  );
}

export const getConfig = async () =>
  ({
    render: 'static',
    staticPaths: blogPosts.map((post) => post.slug),
  }) as const;
