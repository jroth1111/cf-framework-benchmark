import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("stays", "routes/stays.tsx"),
  route("stays/:id", "routes/stay-detail.tsx"),
  route("blog", "routes/blog.tsx"),
  route("blog/:slug", "routes/blog-post.tsx"),
  route("chart", "routes/chart.tsx"),
  route("media", "routes/media.tsx"),
  route("hifi/stays", "routes/hifi-stays.tsx"),
  route("hifi/stays/:id", "routes/hifi-stay-detail.tsx"),
] satisfies RouteConfig;
