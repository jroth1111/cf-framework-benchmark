import { blogPosts, listings } from "../src/bench";

export function onBeforePrerenderStart() {
  return [
    "/",
    "/stays",
    "/blog",
    "/chart",
    "/media",
    ...listings.map((listing) => `/stays/${listing.id}`),
    ...blogPosts.map((post) => `/blog/${post.slug}`),
  ];
}
