import { render } from "solid-js/web";
import { Media } from "../pages/Media";

const el = document.getElementById("app");
if (!el) throw new Error("Missing #app");
render(() => <Media />, el);
