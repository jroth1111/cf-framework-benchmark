import type { PageServerLoad } from "./$types";
import { getPost } from "@cf-bench/dataset";
import { htmlCacheHeader } from "@cf-bench/bench-cache";

export const load: PageServerLoad = async ({ params, request, setHeaders }) => {
  setHeaders({
    "cache-control": htmlCacheHeader("/blog/:slug", request.headers.get("x-cf-bench-profile")),
  });

  const post = getPost(params.slug);
  return { post };
};
