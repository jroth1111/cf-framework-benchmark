import { getPost } from "@cf-bench/dataset";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getPost(slug);
  if (!p) {
    return (
      <>
        <h1 className="h1">Post not found</h1>
        <a className="pill" href="/blog">Back</a>
      </>
    );
  }
  return (
    <>
      <h1 className="h1">{p.title}</h1>
      <div className="muted small">{p.dateISO} • {p.readingMinutes} min read</div>
      <div className="card" style={{ padding: 16, marginTop: 14 }}>
        <div data-testid="blog-html" dangerouslySetInnerHTML={{ __html: p.html }} />
      </div>
      <div style={{ marginTop: 14 }}>
        <a className="pill" href="/blog">← Back to blog</a>
      </div>
    </>
  );
}
