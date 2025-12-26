import { component$, useVisibleTask$ } from "@qwik.dev/core";
import { Link, QwikCityProvider, RouterOutlet } from "@qwik.dev/router";
import { RouterHead } from "./components/router-head/router-head";
import "@cf-bench/ui/styles.css";

export default component$(() => {
  useVisibleTask$(() => {
    const w = window as any;
    const root = (w.__CF_BENCH__ = w.__CF_BENCH__ || {});
    const hydration = (root.hydration = root.hydration || {});
    if (hydration.startMs == null) hydration.startMs = performance.now();
    hydration.endMs = performance.now();
  });

  return (
    <QwikCityProvider>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <RouterHead />
      </head>
      <body lang="en">
        <header class="container nav">
          <Link class="brand" href="/">CF Bench</Link>
          <nav class="links">
            <Link class="pill" href="/stays">Stays</Link>
            <Link class="pill" href="/chart">Chart</Link>
            <Link class="pill" href="/blog">Blog</Link>
          </nav>
        </header>

        <main class="container">
          <RouterOutlet />
          <div class="footer">
            Qwik City variant • stays SSR, blog static generation, chart uses visible task.
          </div>
        </main>

      </body>
    </QwikCityProvider>
  );
});
