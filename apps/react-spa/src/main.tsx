import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Stays } from "./pages/Stays";
import { StayDetail } from "./pages/StayDetail";
import { Chart } from "./pages/Chart";
import { Blog } from "./pages/Blog";
import { BlogPost } from "./pages/BlogPost";
import "./main.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <BrowserRouter>
            <Layout>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/stays" element={<Stays />} />
                    <Route path="/stays/:id" element={<StayDetail />} />
                    <Route path="/chart" element={<Chart />} />
                    <Route path="/blog" element={<Blog />} />
                    <Route path="/blog/:slug" element={<BlogPost />} />
                </Routes>
            </Layout>
        </BrowserRouter>
    </React.StrictMode>
);
