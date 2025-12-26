import { render } from "solid-js/web";
import { Chart } from "../pages/Chart";

const el = document.getElementById("app");
if (!el) throw new Error("Missing #app");
render(() => <Chart />, el);
