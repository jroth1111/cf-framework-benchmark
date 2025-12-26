import { render } from "solid-js/web";
import { BlogPost } from "../pages/BlogPost";

const el = document.getElementById("app");
if (!el) throw new Error("Missing #app");
render(() => <BlogPost />, el);
