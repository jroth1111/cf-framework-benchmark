import { blogPosts } from "../../../src/bench";

export function onBeforePrerenderStart() {
  return Array.from(new Set(blogPosts.map((post) => `/blog/${post.slug}`)));
}
