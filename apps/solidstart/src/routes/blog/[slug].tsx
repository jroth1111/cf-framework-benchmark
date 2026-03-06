import { useParams } from "@solidjs/router";
import { BlogPost } from "../../../../solid/src/pages/BlogPost";

export default function BlogPostPage() {
  const params = useParams<{ slug: string }>();
  return <BlogPost slug={params.slug} />;
}
