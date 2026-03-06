import fs from "node:fs";
import path from "node:path";
import {
  blogPosts,
  chartSymbols,
  chartTimeframes,
  formatUsd,
  getListing,
  getPost,
  listings,
  queryListings,
  queryMedia,
} from "@cf-bench/dataset";

const root = path.resolve(process.cwd());
const pagesDir = path.join(root, "pages");

function rmrf(target) {
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

function mkdirp(target) {
  fs.mkdirSync(target, { recursive: true });
}

function writeFile(target, content) {
  mkdirp(path.dirname(target));
  fs.writeFileSync(target, content, "utf8");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layoutHtml({ title, bodyHtml }) {
  return `
    <div>
      <header class="container nav">
        <a class="brand" href="/">CF Bench</a>
        <nav class="links">
          <a class="pill" href="/stays">Stays</a>
          <a class="pill" href="/chart">Chart</a>
          <a class="pill" href="/media">Media</a>
          <a class="pill" href="/blog">Blog</a>
        </nav>
      </header>

      <main class="container">
        <h1 class="h1">${escapeHtml(title)}</h1>
        ${bodyHtml}
        <div class="footer">
          SolidJS + Vite variant • <span class="kbd">/chart</span> is SPA-like, blog is SSG pages, stays are multi-page routes.
        </div>
      </main>
    </div>
  `.trim();
}

function renderDocument({ title, entry, route, props, bodyHtml }) {
  const propsScript = props ? `<script>window.__PAGE_PROPS__=${JSON.stringify(props)};</script>` : "";
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="/src/main.css" />
    <script>
      (function () {
        var w = window;
        w.__CF_BENCH__ = w.__CF_BENCH__ || {};
        var h = (w.__CF_BENCH__.hydration = w.__CF_BENCH__.hydration || {});
        if (h.startMs == null) h.startMs = performance.now();
      })();
    </script>
  </head>
  <body data-route="${route}">
    <div id="app">${bodyHtml}</div>
    ${propsScript}
    <script type="module" src="/src/entries/${entry}.tsx"></script>
  </body>
</html>`;
}

function renderHome() {
  return layoutHtml({
    title: "Framework benchmark harness",
    bodyHtml: `
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
    `,
  });
}

function renderStays() {
  const listings = queryListings({ page: 1, pageSize: 12 }).results;
  const cards = listings
    .map(
      (listing) => `
        <a class="card" data-testid="stay-card" href="/stays/${listing.id}" style="padding:14px;display:block">
          <div style="display:flex;justify-content:space-between;gap:12px">
            <div>
              <div style="font-weight:700">${escapeHtml(listing.title)}</div>
              <div class="muted small">
                ${escapeHtml(listing.city)}, ${escapeHtml(listing.country)} • ${listing.bedrooms} bd • ${listing.baths} ba • up to ${listing.maxGuests} guests
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:700">
                ${escapeHtml(formatUsd(listing.pricePerNight))} <span class="muted small">/ night</span>
              </div>
              <div class="muted small">★ ${listing.rating} (${listing.reviews})</div>
            </div>
          </div>
          <div class="muted small" style="margin-top:10px">${escapeHtml(listing.summary)}</div>
        </a>
      `
    )
    .join("");

  return layoutHtml({
    title: "Stays",
    bodyHtml: `<p class="muted">Airbnb-style listing index rendered by Solid on Workers.</p><div class="grid cols-2">${cards}</div>`,
  });
}

function renderStayDetail(id) {
  const listing = getListing(id);
  if (!listing) {
    return layoutHtml({
      title: "Stay not found",
      bodyHtml: `<p>Unknown listing.</p><a class="pill" href="/stays">Back</a>`,
    });
  }

  return layoutHtml({
    title: listing.title,
    bodyHtml: `
      <div class="card" style="padding:16px">
        <div class="muted small">
          ${escapeHtml(listing.city)}, ${escapeHtml(listing.country)} • ${listing.bedrooms} bd • ${listing.baths} ba • up to ${listing.maxGuests} guests
        </div>
        <div style="margin-top:10px;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap">
          <div class="pill">★ ${listing.rating} <span class="muted">(${listing.reviews})</span></div>
          <div class="pill"><strong>${escapeHtml(formatUsd(listing.pricePerNight))}</strong> <span class="muted">/ night</span></div>
          <a class="pill" href="/stays">← Back to results</a>
        </div>
        <div data-testid="stay-description" style="margin-top:14px">${listing.descriptionHtml}</div>
      </div>
    `,
  });
}

function renderBlog() {
  const cards = blogPosts
    .map(
      (post) => `
        <a class="card" data-testid="blog-post-card" href="/blog/${post.slug}" style="padding:14px;display:block">
          <div style="font-weight:700">${escapeHtml(post.title)}</div>
          <div class="muted small">${escapeHtml(post.dateISO)} • ${post.readingMinutes} min read</div>
          <div class="muted small" style="margin-top:10px">${escapeHtml(post.excerpt)}</div>
        </a>
      `
    )
    .join("");

  return layoutHtml({
    title: "Blog",
    bodyHtml: `<div class="grid cols-2">${cards}</div>`,
  });
}

function renderBlogPost(slug) {
  const post = getPost(slug);
  if (!post) {
    return layoutHtml({
      title: "Post not found",
      bodyHtml: `<p>Unknown post.</p><a class="pill" href="/blog">Back</a>`,
    });
  }

  return layoutHtml({
    title: post.title,
    bodyHtml: `
      <div class="muted small">${escapeHtml(post.dateISO)} • ${post.readingMinutes} min read</div>
      <div class="card" style="padding:16px;margin-top:14px">
        <div data-testid="blog-html">${post.html}</div>
      </div>
      <div style="margin-top:14px">
        <a class="pill" href="/blog">← Back to blog</a>
      </div>
    `,
  });
}

function renderChart() {
  const symbolOptions = chartSymbols
    .map((symbol) => `<option value="${escapeHtml(symbol)}">${escapeHtml(symbol)}</option>`)
    .join("");
  const timeframeOptions = chartTimeframes
    .map((timeframe) => `<option value="${escapeHtml(timeframe)}">${escapeHtml(timeframe)}</option>`)
    .join("");

  return layoutHtml({
    title: "Chart (SPA-like)",
    bodyHtml: `
      <div class="card" style="padding: 14px">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div class="pill">
            <span class="muted small">Symbol</span>
            <select data-testid="symbol-select" class="input" style="width:140px">${symbolOptions}</select>
          </div>
          <div class="pill">
            <span class="muted small">Timeframe</span>
            <select data-testid="timeframe-select" class="input" style="width:120px">${timeframeOptions}</select>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <label class="muted small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" checked />SMA20</label>
            <label class="muted small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" />SMA50</label>
            <label class="muted small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" />EMA20</label>
            <label class="muted small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" checked />Volume</label>
          </div>
          <div class="muted small">Loading…</div>
        </div>
        <div class="muted small" style="margin-top:10px">
          Pan: drag • Zoom: mousewheel/trackpad • Crosshair: move cursor
        </div>
        <div style="height:420px;margin-top:12px;position:relative">
          <div data-testid="chart-loading" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:var(--bg);border-radius:12px;border:1px solid var(--border);">
            <span class="muted">Loading chart…</span>
          </div>
          <canvas data-testid="chart-canvas" style="width:100%;height:100%;border-radius:12px;border:1px solid var(--border);"></canvas>
        </div>
      </div>
    `,
  });
}

function renderMedia() {
  const items = queryMedia({ pageSize: 30 }).results;
  const current = items[0];
  const feed = items
    .map(
      (item, index) => `
        <button
          data-testid="media-card"
          class="card"
          style="padding:10px;text-align:left;background:var(--panel);cursor:pointer;border:${index === 0 ? "1px solid var(--text)" : "1px solid var(--border)"}"
        >
          <div style="font-weight:600">${escapeHtml(item.title)}</div>
          <div class="muted small">${escapeHtml(item.channel)} • ${escapeHtml(item.publishedISO)}</div>
        </button>
      `
    )
    .join("");

  return layoutHtml({
    title: "Media Feed (SPA-like)",
    bodyHtml: `
      <div class="grid cols-2" style="gap:16px">
        <div class="card" style="padding:14px">
          <h2 style="margin-top:0">Feed</h2>
          <div style="display:grid;gap:10px;max-height:560px;overflow:auto">${feed}</div>
        </div>
        <div class="card" style="padding:14px">
          <h2 style="margin-top:0">Player</h2>
          <div data-testid="media-player" style="min-height:260px">
            <img
              src="${escapeHtml(current.thumbnail)}"
              alt="${escapeHtml(current.title)}"
              style="width:100%;max-height:280px;object-fit:cover;border-radius:10px"
            />
            <h3>${escapeHtml(current.title)}</h3>
            <p class="muted small">${escapeHtml(current.channel)} • ${current.views.toLocaleString()} views</p>
            <p class="muted">${escapeHtml(current.description)}</p>
          </div>
          <button data-testid="media-next" class="btn">Next</button>
        </div>
      </div>
    `,
  });
}

rmrf(pagesDir);
mkdirp(pagesDir);

writeFile(
  path.join(pagesDir, "index.html"),
  renderDocument({ title: "CF Bench — Solid", entry: "home", route: "/", bodyHtml: renderHome() })
);

writeFile(
  path.join(pagesDir, "stays", "index.html"),
  renderDocument({ title: "Stays — Solid", entry: "stays", route: "/stays", bodyHtml: renderStays() })
);

writeFile(
  path.join(pagesDir, "chart", "index.html"),
  renderDocument({ title: "Chart — Solid", entry: "chart", route: "/chart", bodyHtml: renderChart() })
);

writeFile(
  path.join(pagesDir, "media", "index.html"),
  renderDocument({ title: "Media — Solid", entry: "media", route: "/media", bodyHtml: renderMedia() })
);

writeFile(
  path.join(pagesDir, "blog", "index.html"),
  renderDocument({ title: "Blog — Solid", entry: "blog", route: "/blog", bodyHtml: renderBlog() })
);

for (const { id, title } of listings) {
  const route = `/stays/${id}`;
  writeFile(
    path.join(pagesDir, "stays", id, "index.html"),
    renderDocument({
      title: `${title} — Solid`,
      entry: "stay",
      route,
      props: { id },
      bodyHtml: renderStayDetail(id),
    })
  );
}

for (const post of blogPosts) {
  const route = `/blog/${post.slug}`;
  writeFile(
    path.join(pagesDir, "blog", post.slug, "index.html"),
    renderDocument({
      title: `${post.title} — Solid`,
      entry: "post",
      route,
      props: { slug: post.slug },
      bodyHtml: renderBlogPost(post.slug),
    })
  );
}

console.log(`Generated pages in ${pagesDir}`);
