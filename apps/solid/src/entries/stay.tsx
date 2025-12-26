import { render } from "solid-js/web";
import { StayDetail } from "../pages/StayDetail";

const el = document.getElementById("app");
if (!el) throw new Error("Missing #app");
render(() => <StayDetail />, el);
