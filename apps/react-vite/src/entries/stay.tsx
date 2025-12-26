import React from "react";
import { createRoot } from "react-dom/client";
import { StayDetail } from "../pages/StayDetail";

const el = document.getElementById("app");
if (!el) throw new Error("Missing #app");
createRoot(el).render(<StayDetail />);
