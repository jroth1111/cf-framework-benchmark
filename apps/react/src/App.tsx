import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";

const Stays = lazy(async () => {
  const module = await import("./pages/Stays");
  return { default: module.Stays };
});

const StayDetail = lazy(async () => {
  const module = await import("./pages/StayDetail");
  return { default: module.StayDetail };
});

const Chart = lazy(async () => {
  const module = await import("./pages/Chart");
  return { default: module.Chart };
});

const Media = lazy(async () => {
  const module = await import("./pages/Media");
  return { default: module.Media };
});

const Blog = lazy(async () => {
  const module = await import("./pages/Blog");
  return { default: module.Blog };
});

const BlogPost = lazy(async () => {
  const module = await import("./pages/BlogPost");
  return { default: module.BlogPost };
});

export function App() {
  return (
    <Layout>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/stays" element={<Stays />} />
          <Route path="/stays/:id" element={<StayDetail />} />
          <Route path="/chart" element={<Chart />} />
          <Route path="/media" element={<Media />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
