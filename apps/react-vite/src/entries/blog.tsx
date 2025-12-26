import React from "react";
import { createRoot } from "react-dom/client";
import { Blog } from "../pages/Blog";

const el = document.getElementById("app");
if (!el) throw new Error("Missing #app");
createRoot(el).render(<Blog />);
