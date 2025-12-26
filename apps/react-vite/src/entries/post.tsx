import React from "react";
import { createRoot } from "react-dom/client";
import { BlogPost } from "../pages/BlogPost";

const el = document.getElementById("app");
if (!el) throw new Error("Missing #app");
createRoot(el).render(<BlogPost />);
