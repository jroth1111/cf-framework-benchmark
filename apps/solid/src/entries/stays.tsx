import { render } from "solid-js/web";
import { Stays } from "../pages/Stays";

const el = document.getElementById("app");
if (!el) throw new Error("Missing #app");
render(() => <Stays />, el);
