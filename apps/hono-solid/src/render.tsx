import {
  BENCH_MEDIA_PAGE_SIZE,
  blogPosts,
  chartSymbols,
  chartTimeframes,
  formatUsd,
  getListing,
  getPost,
  queryListings,
  queryMedia,
} from "@cf-bench/dataset";

export type RenderedRoute = {
  route: "home" | "stays" | "stay" | "blog" | "post" | "chart" | "media";
  title: string;
  html: string;
  pageProps?: { id?: string; slug?: string };
};

function esc(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function layout(title: string, body: string, footer = "Benchmark route surface on Cloudflare Workers.") {
  return `
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
      ${body}
      <div class="footer">${footer}</div>
    </main>
  `.trim();
}

function renderHome() {
  return layout(
    "Framework benchmark harness",
    `
      <h1 class="h1">Framework benchmark harness</h1>
      <div class="grid cols-3">
        <div class="card"><h2>SPA-like</h2><p class="muted">Interactive chart with symbol switching.</p><a class="btn" href="/chart">Open chart</a></div>
        <div class="card"><h2>App pages</h2><p class="muted">Listings index + detail pages.</p><a class="btn" href="/stays">Browse stays</a></div>
        <div class="card"><h2>SSG blog</h2><p class="muted">Prerendered route content.</p><a class="btn" href="/blog">Read blog</a></div>
        <div class="card"><h2>Media feed</h2><p class="muted">Feed browsing and player interactions.</p><a class="btn" href="/media">Open media</a></div>
      </div>
    `
  );
}

function renderStays() {
  const cards = queryListings({ pageSize: 12 }).results
    .map(
      (listing) => `
        <a class="card" data-testid="stay-card" href="/stays/${listing.id}" style="padding:14px;display:block">
          <div style="display:flex;justify-content:space-between;gap:12px">
            <div>
              <div style="font-weight:700">${esc(listing.title)}</div>
              <div class="muted small">${esc(listing.city)}, ${esc(listing.country)} • ${listing.bedrooms} bd • ${listing.baths} ba • up to ${listing.maxGuests} guests</div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:700">${esc(formatUsd(listing.pricePerNight))} <span class="muted small">/ night</span></div>
              <div class="muted small">★ ${listing.rating} (${listing.reviews})</div>
            </div>
          </div>
          <div class="muted small" style="margin-top:10px">${esc(listing.summary)}</div>
        </a>
      `
    )
    .join("");

  return layout(
    "Stays",
    `<h1 class="h1">Stays</h1><p class="muted">Airbnb-style listing index.</p><div class="grid cols-3">${cards}</div>`
  );
}

function renderStay(id: string) {
  const listing = getListing(id);
  if (!listing) {
    return {
      title: "Stay not found",
      html: layout("Stay not found", `<p>Unknown listing.</p>`),
    };
  }

  const reviews = listing.reviewSamples
    .map(
      (review) => `
        <div class="card">
          <div style="font-weight:700">${esc(review.name)}</div>
          <div class="muted small">${review.dateISO} • ★ ${review.rating}</div>
          <p>${esc(review.text)}</p>
        </div>
      `
    )
    .join("");

  return {
    title: listing.title,
    html: layout(
      listing.title,
      `
        <a class="pill" href="/stays">Back to stays</a>
        <h1 class="h1" style="margin-top:16px">${esc(listing.title)}</h1>
        <div class="muted">${esc(listing.city)}, ${esc(listing.country)} • Hosted by ${esc(listing.hostName)}</div>
        <div class="grid cols-2" style="margin-top:18px">
          <section class="card">
            <div data-testid="stay-description">${listing.descriptionHtml}</div>
          </section>
          <aside class="card">
            <div style="font-weight:700;font-size:1.2rem">${esc(formatUsd(listing.pricePerNight))} <span class="muted small">/ night</span></div>
            <p class="muted">Cleaning ${esc(formatUsd(listing.cleaningFee))} • Service ${esc(formatUsd(listing.serviceFee))}</p>
            <p class="muted">Superhost: ${listing.superhost ? "yes" : "no"} • Since ${esc(listing.hostSinceISO)}</p>
            <div class="small muted">Amenities: ${esc(listing.amenities.join(", "))}</div>
          </aside>
        </div>
        <h2 style="margin-top:24px">Reviews</h2>
        <div class="grid cols-2">${reviews}</div>
      `
    ),
  };
}

function renderBlog() {
  const cards = blogPosts
    .slice(0, 12)
    .map(
      (post) => `
        <a class="card" data-testid="blog-post-card" href="/blog/${post.slug}" style="display:block">
          <div style="font-weight:700">${esc(post.title)}</div>
          <div class="muted small">${post.dateISO} • ${post.readingMinutes} min read</div>
          <p class="muted">${esc(post.excerpt)}</p>
        </a>
      `
    )
    .join("");

  return layout("Blog", `<h1 class="h1">Blog</h1><div class="grid cols-2">${cards}</div>`);
}

function renderPost(slug: string) {
  const post = getPost(slug);
  if (!post) {
    return {
      title: "Post not found",
      html: layout("Post not found", `<p>Unknown post.</p>`),
    };
  }
  return {
    title: post.title,
    html: layout(
      post.title,
      `
        <a class="pill" href="/blog">Back to blog</a>
        <h1 class="h1" style="margin-top:16px">${esc(post.title)}</h1>
        <div class="muted">${post.dateISO} • ${post.readingMinutes} min read</div>
        <article class="card" data-testid="blog-html" style="margin-top:18px">${post.html}</article>
      `
    ),
  };
}

function renderChart() {
  const symbolOptions = chartSymbols.map((symbol) => `<option value="${esc(symbol)}">${esc(symbol)}</option>`).join("");
  const timeframeOptions = chartTimeframes
    .map((timeframe) => `<option value="${esc(timeframe)}"${timeframe === "1h" ? " selected" : ""}>${esc(timeframe)}</option>`)
    .join("");

  return layout(
    "Chart (SPA-like)",
    `
      <div id="chart-root">
        <div class="controls card" style="margin-bottom:16px">
          <label>Symbol <select data-testid="symbol-select">${symbolOptions}</select></label>
          <label>Timeframe <select data-testid="timeframe-select">${timeframeOptions}</select></label>
        </div>
        <div class="card"><canvas data-testid="chart-canvas" width="900" height="420"></canvas></div>
      </div>
    `
  );
}

function renderMedia() {
  const cards = queryMedia({ pageSize: BENCH_MEDIA_PAGE_SIZE }).results
    .map(
      (item) => `
        <button class="card" type="button" data-testid="media-card" data-media-id="${esc(item.id)}">
          <div style="font-weight:700">${esc(item.title)}</div>
          <div class="muted small">${esc(item.channel)} • ${item.publishedISO}</div>
        </button>
      `
    )
    .join("");

  return layout(
    "Media Feed (SPA-like)",
    `
      <div class="grid cols-2">
        <section>
          <div class="grid">${cards}</div>
        </section>
        <aside class="card">
          <div data-testid="media-player">Select a video to start playback.</div>
          <button class="btn" type="button" data-testid="media-next" style="margin-top:16px">Next</button>
        </aside>
      </div>
    `
  );
}

export function renderRoute(pathname: string): RenderedRoute | null {
  if (pathname === "/") {
    return { route: "home", title: "Framework benchmark harness", html: renderHome() };
  }

  if (pathname === "/stays") {
    return { route: "stays", title: "Stays", html: renderStays() };
  }

  const stayMatch = pathname.match(/^\/stays\/([^/]+)$/);
  if (stayMatch) {
    const id = stayMatch[1];
    const rendered = renderStay(id);
    return { route: "stay", title: rendered.title, html: rendered.html, pageProps: { id } };
  }

  if (pathname === "/blog") {
    return { route: "blog", title: "Blog", html: renderBlog() };
  }

  const postMatch = pathname.match(/^\/blog\/([^/]+)$/);
  if (postMatch) {
    const slug = postMatch[1];
    const rendered = renderPost(slug);
    return { route: "post", title: rendered.title, html: rendered.html, pageProps: { slug } };
  }

  if (pathname === "/chart") {
    return { route: "chart", title: "Chart (SPA-like)", html: renderChart() };
  }

  if (pathname === "/media") {
    return { route: "media", title: "Media Feed (SPA-like)", html: renderMedia() };
  }

  return null;
}
