import React from "react";
import { createRoot } from "react-dom/client";
import { Chart } from "../pages/Chart";

const el = document.getElementById("app");
if (!el) throw new Error("Missing #app");
createRoot(el).render(<Chart />);
