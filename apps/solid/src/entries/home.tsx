import { render } from "solid-js/web";
import { Home } from "../pages/Home";

const el = document.getElementById("app");
if (!el) throw new Error("Missing #app");
render(() => <Home />, el);
