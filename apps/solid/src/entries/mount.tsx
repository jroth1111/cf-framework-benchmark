import type { JSX } from "solid-js";
import { render } from "solid-js/web";
import "../main.css";

export function mountPage(renderPage: () => JSX.Element) {
  const el = document.getElementById("app");
  if (!el) throw new Error("Missing #app");

  el.textContent = "";
  render(renderPage, el);

  requestAnimationFrame(() => {
    const w = window as any;
    w.__CF_BENCH__ = w.__CF_BENCH__ || {};
    const hydration = (w.__CF_BENCH__.hydration = w.__CF_BENCH__.hydration || {});
    hydration.endMs = performance.now();
  });
}
