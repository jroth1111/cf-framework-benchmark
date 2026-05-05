import { Blog } from "../../../../solid/src/pages/Blog";
import { BenchHeaders } from "../../lib/headers";

export default function BlogPage() {
  return (
    <>
      <BenchHeaders cacheControl="public, max-age=0, s-maxage=60" />
      <Blog />
    </>
  );
}
