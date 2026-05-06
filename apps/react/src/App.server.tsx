import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Stays } from "./pages/Stays";
import { StayDetail } from "./pages/StayDetail";
import { Chart } from "./pages/Chart";
import { Media } from "./pages/Media";
import { Blog } from "./pages/Blog";
import { BlogPost } from "./pages/BlogPost";
import { HifiStays } from "./pages/HifiStays";
import { HifiStayDetail } from "./pages/HifiStayDetail";

export function AppServer() {
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
        <Route path="/hifi/stays" element={<HifiStays />} />
        <Route path="/hifi/stays/:id" element={<HifiStayDetail />} />
      </Routes>
    </Layout>
  );
}
