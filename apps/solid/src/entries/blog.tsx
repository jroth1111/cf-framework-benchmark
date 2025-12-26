import { render } from "solid-js/web";
import { Blog } from "../pages/Blog";

const el = document.getElementById("app");
if (!el) throw new Error("Missing #app");
render(() => <Blog />, el);
