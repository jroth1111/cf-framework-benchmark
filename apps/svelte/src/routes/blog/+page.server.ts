import type { PageServerLoad } from "./$types";
import { blogPosts } from "@cf-bench/dataset";
import { htmlCacheHeader } from "@cf-bench/bench-cache";

export const load: PageServerLoad = async ({ request, setHeaders }) => {
  setHeaders({
    "cache-control": htmlCacheHeader("/blog", request.headers.get("x-cf-bench-profile")),
  });

  return { posts: blogPosts };
};
