import type { PageServerLoad } from "./$types";
import { blogPosts } from "@cf-bench/dataset";
import { benchCacheHeader } from "$lib/bench-cache";

export const load: PageServerLoad = async ({ request, setHeaders }) => {
  const cache = benchCacheHeader(request.headers.get("x-cf-bench-profile"), "list");
  if (cache) setHeaders({ "cache-control": cache });

  return { posts: blogPosts };
};
