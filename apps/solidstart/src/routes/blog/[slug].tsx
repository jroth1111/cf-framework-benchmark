import { useParams } from "@solidjs/router";
import { BlogPost } from "../../../../solid/src/pages/BlogPost";
import { BenchHeaders } from "../../lib/headers";

export default function BlogPostPage() {
  const params = useParams<{ slug: string }>();
  return (
    <>
      <BenchHeaders routeId="/blog/:slug" />
      <BlogPost slug={params.slug} />
    </>
  );
}
