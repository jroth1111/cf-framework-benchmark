import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Stays } from "./pages/Stays";
import { StayDetail } from "./pages/StayDetail";
import { Chart } from "./pages/Chart";
import { Media } from "./pages/Media";
import { Blog } from "./pages/Blog";
import { BlogPost } from "./pages/BlogPost";

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/stays" element={<Stays />} />
        <Route path="/stays/:id" element={<StayDetail />} />
        <Route path="/chart" element={<Chart />} />
        <Route path="/media" element={<Media />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
      </Routes>
    </Layout>
  );
}
