import { useParams } from "@solidjs/router";
import { BlogPost } from "../../../../solid/src/pages/BlogPost";
import { BenchHeaders } from "../../lib/headers";

export default function BlogPostPage() {
  const params = useParams<{ slug: string }>();
  return (
    <>
      <BenchHeaders cacheControl="public, max-age=0, s-maxage=300, stale-while-revalidate=600" />
      <BlogPost slug={params.slug} />
    </>
  );
}
