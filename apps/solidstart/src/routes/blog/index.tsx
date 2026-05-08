import { Blog } from "../../../../solid/src/pages/Blog";
import { BenchHeaders } from "../../lib/headers";

export default function BlogPage() {
  return (
    <>
      <BenchHeaders routeId="/blog" />
      <Blog />
    </>
  );
}
