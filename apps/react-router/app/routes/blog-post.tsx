import { Link, data } from "react-router";
import type { Route } from "./+types/blog-post";
import { getPost } from "../lib/data";

export function loader({ params }: Route.LoaderArgs) {
  const post = getPost(params.slug || "");
  if (!post) {
    throw data("Not found", { status: 404 });
  }
  return { post };
}

export default function BlogPostRoute({ loaderData }: Route.ComponentProps) {
  const { post } = loaderData;
  return (
    <>
      <Link className="pill" to="/blog">
        ← Back to blog
      </Link>
      <h1 className="h1">{post.title}</h1>
      <div className="small muted">
        {post.dateISO} • {post.readingMinutes} min read
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div data-testid="blog-html" dangerouslySetInnerHTML={{ __html: post.html }} />
      </div>
    </>
  );
}
