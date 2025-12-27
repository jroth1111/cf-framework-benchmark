import { render } from "solid-js/web";
import { onMount } from "solid-js";
import { Home } from "../pages/Home";

const el = document.getElementById("app");
if (!el) throw new Error("Missing #app");

render(() => <Home />, el);

// Mark hydration end after app mounts
onMount(() => {
  if (typeof window !== "undefined") {
    const w = window as any;
    w.__CF_BENCH__ = w.__CF_BENCH__ || {};
    const hydration = w.__CF_BENCH__.hydration = w.__CF_BENCH__.hydration || {};
    hydration.endMs = performance.now();
  }
});
