import type { PageServerLoad } from "./$types";
import { getPost } from "@cf-bench/dataset";

export const load: PageServerLoad = async ({ params }) => {
  const post = getPost(params.slug);
  return { post };
};
