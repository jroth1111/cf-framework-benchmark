import type { PageServerLoad } from "./$types";
import { blogPosts } from "@cf-bench/dataset";

export const load: PageServerLoad = async () => {
  return { posts: blogPosts };
};
