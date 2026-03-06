import { Layout } from "../components/Layout";

export function Home() {
  return (
    <Layout title="Framework benchmark harness">
      <div class="grid cols-3">
        <div class="card" style="padding:16px">
          <h2>SPA-like</h2>
          <p class="muted">Interactive chart with symbol switching (no full reload).</p>
          <a class="btn" href="/chart">Open chart</a>
        </div>
        <div class="card" style="padding:16px">
          <h2>App pages</h2>
          <p class="muted">Listings index + detail pages rendered by Solid.</p>
          <a class="btn" href="/stays">Browse stays</a>
        </div>
        <div class="card" style="padding:16px">
          <h2>SSG blog</h2>
          <p class="muted">Prebuilt blog pages.</p>
          <a class="btn" href="/blog">Read blog</a>
        </div>
        <div class="card" style="padding:16px">
          <h2>Media feed</h2>
          <p class="muted">YouTube-like browse and player interactions.</p>
          <a class="btn" href="/media">Open media</a>
        </div>
      </div>

      <div class="card" style="padding:16px;margin-top:14px">
        <p class="muted small">
          This page is rendered by Solid and deployed directly to Cloudflare Workers.
        </p>
      </div>
    </Layout>
  );
}
