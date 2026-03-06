import { getListing, getPost } from "@cf-bench/dataset";
import { renderToString } from "solid-js/web";
import { Home } from "../src/pages/Home";
import { Stays } from "../src/pages/Stays";
import { StayDetail } from "../src/pages/StayDetail";
import { Blog } from "../src/pages/Blog";
import { BlogPost } from "../src/pages/BlogPost";
import { Chart } from "../src/pages/Chart";
import { Media } from "../src/pages/Media";

export type RenderedRoute = {
  route: "home" | "stays" | "stay" | "blog" | "post" | "chart" | "media";
  title: string;
  html: string;
  pageProps?: { id?: string; slug?: string };
};

export function renderRoute(pathname: string): RenderedRoute | null {
  if (pathname === "/") {
    return {
      route: "home",
      title: "Framework benchmark harness",
      html: renderToString(() => <Home />),
    };
  }

  if (pathname === "/stays") {
    return {
      route: "stays",
      title: "Stays",
      html: renderToString(() => <Stays />),
    };
  }

  const stayMatch = pathname.match(/^\/stays\/([^/]+)$/);
  if (stayMatch) {
    const id = stayMatch[1];
    return {
      route: "stay",
      title: getListing(id)?.title ?? "Stay not found",
      html: renderToString(() => <StayDetail id={id} />),
      pageProps: { id },
    };
  }

  if (pathname === "/blog") {
    return {
      route: "blog",
      title: "Blog",
      html: renderToString(() => <Blog />),
    };
  }

  const postMatch = pathname.match(/^\/blog\/([^/]+)$/);
  if (postMatch) {
    const slug = postMatch[1];
    return {
      route: "post",
      title: getPost(slug)?.title ?? "Post not found",
      html: renderToString(() => <BlogPost slug={slug} />),
      pageProps: { slug },
    };
  }

  if (pathname === "/chart") {
    return {
      route: "chart",
      title: "Chart (SPA-like)",
      html: renderToString(() => <Chart />),
    };
  }

  if (pathname === "/media") {
    return {
      route: "media",
      title: "Media Feed (SPA-like)",
      html: renderToString(() => <Media />),
    };
  }

  return null;
}
