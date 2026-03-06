import { getPost } from "../../../src/bench";
import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const post = getPost(pageContext.routeParams.slug);
  const config = useConfig();

  if (post) {
    config({
      title: `${post.title} | CF Bench`,
      description: post.excerpt,
    });
  }

  return { post };
}
