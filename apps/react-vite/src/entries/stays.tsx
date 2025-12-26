import React from "react";
import { createRoot } from "react-dom/client";
import { Stays } from "../pages/Stays";

const el = document.getElementById("app");
if (!el) throw new Error("Missing #app");
createRoot(el).render(<Stays />);
