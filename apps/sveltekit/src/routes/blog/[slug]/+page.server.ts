import type { PageServerLoad } from "./$types";
import { getPost } from "@cf-bench/dataset";
import { benchCacheHeader } from "$lib/bench-cache";

export const load: PageServerLoad = async ({ params, request, setHeaders }) => {
  const cache = benchCacheHeader(request.headers.get("x-cf-bench-profile"), "detail");
  if (cache) setHeaders({ "cache-control": cache });

  const post = getPost(params.slug);
  return { post };
};
