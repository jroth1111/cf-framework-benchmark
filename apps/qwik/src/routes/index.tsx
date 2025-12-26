import { component$ } from "@qwik.dev/core";
import { Link } from "@qwik.dev/router";

export default component$(() => {
  return (
    <>
      <h1 class="h1">Framework benchmark harness</h1>

      <div class="grid cols-3">
        <div class="card" style="padding:16px">
          <h2>SPA-like</h2>
          <p class="muted">Interactive chart with symbol switching.</p>
          <Link class="btn" href="/chart">Open chart</Link>
        </div>
        <div class="card" style="padding:16px">
          <h2>App pages</h2>
          <p class="muted">Listings index + detail pages.</p>
          <Link class="btn" href="/stays">Browse stays</Link>
        </div>
        <div class="card" style="padding:16px">
          <h2>SSG blog</h2>
          <p class="muted">Generated at build time.</p>
          <Link class="btn" href="/blog">Read blog</Link>
        </div>
      </div>
    </>
  );
});
