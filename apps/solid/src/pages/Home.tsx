import { createSignal, onMount, Show } from "solid-js";
import { Layout } from "../components/Layout";

export function Home() {
  const [mounted, setMounted] = createSignal(false);

  // Optimize: Show skeleton before mounting
  onMount(() => {
    // Defer rendering to next frame for smoother appearance
    requestAnimationFrame(() => {
      setMounted(true);
    });
  });

  return (
    <Layout title="Framework benchmark harness">
      <Show when={mounted()} fallback={
        <div class="card" style="padding: 16px; min-height: 400px;">
          <div class="skeleton" style="height: 28px; width: 200px; margin-bottom: 16px;" />
          <div class="grid cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} style="margin-bottom: 16px;">
                <div class="skeleton" style="height: 32px; width: 150px; margin-bottom: 8px;" />
                <div class="skeleton" style="height: 16px; width: 100%; margin-bottom: 12px;" />
                <div class="skeleton" style="height: 40px; width: 120px;" />
              </div>
            ))}
          </div>
        </div>
      }>
        <div class="grid cols-3">
          <div class="card" style="padding:16px">
            <h2>SPA-like</h2>
            <p class="muted">Interactive chart with symbol switching (no full reload).</p>
            <a class="btn" href="/chart">Open chart</a>
          </div>
          <div class="card" style="padding:16px">
            <h2>App pages</h2>
            <p class="muted">Listings index + detail pages (Airbnb-ish).</p>
            <a class="btn" href="/stays">Browse stays</a>
          </div>
          <div class="card" style="padding:16px">
            <h2>SSG blog</h2>
            <p class="muted">Prebuilt blog pages.</p>
            <a class="btn" href="/blog">Read blog</a>
          </div>
        </div>

        <div class="card" style="padding:16px;margin-top:14px">
          <p class="muted small">
            This page is rendered client-side in Solid. Run the Playwright bench runner against each deployed framework.
          </p>
        </div>
      </Show>
    </Layout>
  );
}
