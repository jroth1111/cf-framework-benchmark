import { component$ } from "@qwik.dev/core";
import { routeLoader$ } from "@qwik.dev/router";
import type { StaticGenerateHandler } from "@qwik.dev/router";
import { blogPosts, getPost } from "@cf-bench/dataset";

export const onStaticGenerate: StaticGenerateHandler = async () => {
  return {
    params: blogPosts.map((p) => ({ slug: p.slug })),
  };
};

export const usePost = routeLoader$(({ params }) => {
  return { post: getPost(params.slug) };
});

export default component$(() => {
  const { post } = usePost().value;
  if (!post) {
    return (
      <>
        <h1 class="h1">Post not found</h1>
        <a class="pill" href="/blog">Back</a>
      </>
    );
  }

  return (
    <>
      <h1 class="h1">{post.title}</h1>
      <div class="muted small">{post.dateISO} • {post.readingMinutes} min read</div>
      <div class="card" style="padding:16px;margin-top:14px">
        <div data-testid="blog-html" dangerouslySetInnerHTML={post.html as any} />
      </div>
      <div style="margin-top:14px">
        <a class="pill" href="/blog">← Back to blog</a>
      </div>
    </>
  );
});
