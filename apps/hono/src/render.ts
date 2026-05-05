import {
  BENCH_MEDIA_PAGE_SIZE,
  blogPosts,
  chartSymbols,
  chartTimeframes,
  formatUsd,
  getListing,
  getPost,
  queryListings,
} from "@cf-bench/dataset";

const CACHE = {
  noStore: "no-store",
  short: "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
  detail: "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
};

type HonoPageMatch =
  | { page: "home" }
  | { page: "stays" }
  | { page: "stay"; id: string }
  | { page: "blog" }
  | { page: "post"; slug: string }
  | { page: "chart" }
  | { page: "media" };

function toUrl(input: URL | Request | string) {
  if (input instanceof URL) return input;
  if (input instanceof Request) return new URL(input.url);
  if (typeof input === "string") return new URL(input, "https://cf-bench.local");
  return new URL("https://cf-bench.local");
}

function getIsolateId() {
  const g = globalThis as typeof globalThis & { __CF_BENCH_ISOLATE_ID?: string };
  if (!g.__CF_BENCH_ISOLATE_ID) {
    g.__CF_BENCH_ISOLATE_ID = crypto.randomUUID();
  }
  return g.__CF_BENCH_ISOLATE_ID;
}

function withServerTiming(headers: HeadersInit | null, start: number) {
  const next = new Headers(headers ?? undefined);
  if (!next.has("server-timing")) {
    next.set("server-timing", `cf_bench;dur=${(performance.now() - start).toFixed(1)};desc="${getIsolateId()}"`);
  }
  return next;
}

function esc(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(title: string, body: string, extraHead = "") {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <style>
      :root {
        --bg: #0b0d12;
        --panel: #111827;
        --text: #e5e7eb;
        --muted: #9ca3af;
        --border: rgba(255, 255, 255, 0.12);
        --accent: #7c3aed;
        --accent2: #22c55e;
        --radius: 14px;
        --shadow: 0 10px 25px rgba(0,0,0,0.35);
        --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        color-scheme: dark;
        font-family: var(--sans);
      }
      * { box-sizing: border-box; }
      html, body { height: 100%; }
      body {
        margin: 0;
        background: radial-gradient(1200px 600px at 20% -10%, rgba(124, 58, 237, 0.35), transparent 55%),
                    radial-gradient(900px 500px at 90% 0%, rgba(34, 197, 94, 0.22), transparent 50%),
                    var(--bg);
        color: var(--text);
        font-family: var(--sans);
      }
      a { color: inherit; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .container { width: min(1100px, calc(100% - 32px)); margin: 0 auto; }
      .nav { display: flex; gap: 12px; align-items: center; justify-content: space-between; padding: 18px 0; }
      .nav a.brand { font-weight: 700; letter-spacing: 0.2px; text-decoration: none; }
      .nav .links { display: flex; flex-wrap: wrap; gap: 12px; }
      .card { background: rgba(17, 24, 39, 0.55); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 14px; }
      .grid { display: grid; gap: 14px; }
      .grid.cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .grid.cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      @media (max-width: 860px) { .grid.cols-2, .grid.cols-3 { grid-template-columns: repeat(1, minmax(0, 1fr)); } }
      .muted { color: var(--muted); }
      .small { font-size: 13px; }
      .h1 { font-size: 40px; line-height: 1.08; margin: 18px 0 10px; }
      .pill { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 999px; background: rgba(17, 24, 39, 0.55); box-shadow: var(--shadow); }
      .btn { cursor: pointer; font: inherit; padding: 10px 14px; border-radius: 12px; border: 1px solid var(--border); background: rgba(124, 58, 237, 0.18); color: var(--text); }
      .input, select { width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border); background: rgba(0,0,0,0.25); color: var(--text); }
      .footer { margin: 36px 0 40px; color: var(--muted); font-size: 13px; }
      canvas { background: #0f1620; display: block; width: 100%; height: 100%; border-radius: 12px; border: 1px solid var(--border); }
    </style>
    <script>
      (function () {
        var w = globalThis;
        w.__CF_BENCH__ = w.__CF_BENCH__ || {};
        var hydration = (w.__CF_BENCH__.hydration = w.__CF_BENCH__.hydration || {});
        if (!Number.isFinite(hydration.startMs)) hydration.startMs = performance.now();
      })();
    </script>
    ${extraHead}
  </head>
  <body>
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
      <div class="footer">Benchmark route surface on Cloudflare Workers.</div>
    </main>
    <script>
      (function () {
        var w = globalThis;
        w.__CF_BENCH__ = w.__CF_BENCH__ || {};
        var hydration = (w.__CF_BENCH__.hydration = w.__CF_BENCH__.hydration || {});
        hydration.endMs = performance.now();
      })();
    </script>
  </body>
</html>`;
}

function homePage() {
  return shell(
    "Framework benchmark harness",
    `
      <h1 class="h1">Framework benchmark harness</h1>
      <div class="grid cols-3">
        <div class="card"><h2>SPA-like</h2><p class="muted">Interactive chart with symbol switching.</p><p><a class="btn" href="/chart">Open chart</a></p></div>
        <div class="card"><h2>App pages</h2><p class="muted">Listings index + detail pages.</p><p><a class="btn" href="/stays">Browse stays</a></p></div>
        <div class="card"><h2>SSG blog</h2><p class="muted">Prerendered route content.</p><p><a class="btn" href="/blog">Read blog</a></p></div>
        <div class="card"><h2>Media feed</h2><p class="muted">Feed browsing and player interactions.</p><p><a class="btn" href="/media">Open media</a></p></div>
      </div>
    `
  );
}

function staysPage(input: URL | Request | string) {
  const url = toUrl(input);
  const page = Number(url.searchParams.get("page") || "1");
  const pageSize = Number(url.searchParams.get("pageSize") || "12");
  const data = queryListings({ page, pageSize });
  const cards = data.results
    .map(
      (listing) => `
    <a class="card" data-testid="stay-card" href="/stays/${esc(listing.id)}" style="display:block">
      <div style="font-weight:700">${esc(listing.title)}</div>
      <div class="small muted">${esc(listing.city)}, ${esc(listing.country)} • ${esc(listing.bedrooms)} bd • ${esc(listing.baths)} ba • up to ${esc(listing.maxGuests)} guests</div>
      <div style="margin-top:8px"><strong>${esc(formatUsd(listing.pricePerNight))}</strong> <span class="muted small">/ night</span></div>
      <div class="muted small" style="margin-top:10px">${esc(listing.summary)}</div>
    </a>`
    )
    .join("");

  return shell(
    "Stays",
    `
      <h1 class="h1">Stays</h1>
      <p class="muted">Airbnb-style listing index.</p>
      <div class="grid cols-3" style="margin-top:12px">${cards}</div>
    `
  );
}

function stayDetailPage(id: string) {
  const listing = getListing(id);
  if (!listing) {
    return shell(
      "Stay not found",
      `<h1 class="h1">Stay not found</h1><div class="card"><p class="muted">Unknown listing.</p></div>`
    );
  }

  return shell(
    listing.title,
    `
      <a class="pill" href="/stays">← Back to listings</a>
      <h1 class="h1">${esc(listing.title)}</h1>
      <div class="small muted">${esc(listing.city)}, ${esc(listing.country)} • ${esc(listing.neighborhood)}</div>
      <div class="card" style="margin-top:12px">
        <div data-testid="stay-description">${listing.descriptionHtml}</div>
      </div>
    `
  );
}

function blogPage() {
  const cards = blogPosts
    .map(
      (post) => `
      <a class="card" data-testid="blog-post-card" href="/blog/${esc(post.slug)}">
        <div style="font-weight:700">${esc(post.title)}</div>
        <div class="small muted">${esc(post.dateISO)} • ${esc(post.readingMinutes)} min read</div>
        <p class="muted">${esc(post.excerpt)}</p>
      </a>
    `
    )
    .join("");

  return shell("Blog", `<h1 class="h1">Blog</h1><div class="grid cols-2">${cards}</div>`);
}

function blogPostPage(slug: string) {
  const post = getPost(slug);
  if (!post) {
    return shell("Post not found", `<h1 class="h1">Post not found</h1>`);
  }

  return shell(
    post.title,
    `
      <a class="pill" href="/blog">← Back to blog</a>
      <h1 class="h1">${esc(post.title)}</h1>
      <div class="small muted">${esc(post.dateISO)} • ${esc(post.readingMinutes)} min read</div>
      <div class="card" style="margin-top:12px"><div data-testid="blog-html">${post.html}</div></div>
    `
  );
}

function chartPage() {
  return shell(
    "Chart",
    `
      <h1 class="h1">Chart (SPA-like)</h1>
      <div class="card">
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center">
          <label class="pill">
            <span class="small muted">Symbol</span>
            <select class="input" data-testid="symbol-select">
              ${chartSymbols.map((symbol) => `<option value="${esc(symbol)}">${esc(symbol)}</option>`).join("")}
            </select>
          </label>
          <label class="pill">
            <span class="small muted">Timeframe</span>
            <select class="input" data-testid="timeframe-select">
              ${chartTimeframes
                .map((timeframe) => `<option value="${esc(timeframe)}"${timeframe === "1h" ? " selected" : ""}>${esc(timeframe)}</option>`)
                .join("")}
            </select>
          </label>
          <label class="small muted"><input data-testid="ind-sma20" data-chart-indicator="sma20" type="checkbox" checked /> SMA20</label>
          <label class="small muted"><input data-testid="ind-sma50" data-chart-indicator="sma50" type="checkbox" /> SMA50</label>
          <label class="small muted"><input data-testid="ind-ema20" data-chart-indicator="ema20" type="checkbox" /> EMA20</label>
          <label class="small muted"><input data-testid="ind-volume" data-chart-indicator="volume" type="checkbox" checked /> Volume</label>
          <span class="muted small" data-testid="chart-status">Loading candles...</span>
        </div>
        <div style="height:420px; margin-top:12px">
          <canvas data-testid="chart-canvas" width="1200" height="420"></canvas>
        </div>
      </div>
      <script type="module" src="/assets/chart-client.js"></script>
    `
  );
}

function mediaPage() {
  return shell(
    "Media",
    `
      <h1 class="h1">Media Feed (SPA-like)</h1>
      <div class="grid cols-2">
        <div class="card">
          <h2 style="margin-top:0">Feed</h2>
          <div id="media-list" class="grid" style="max-height:540px; overflow:auto">
            <button class="btn" data-testid="media-card">Loading media…</button>
          </div>
        </div>
        <div class="card">
          <h2 style="margin-top:0">Player</h2>
          <div data-testid="media-player" id="media-player" class="muted">Select a media item.</div>
          <button class="btn" data-testid="media-next" id="media-next" style="margin-top:12px">Next</button>
        </div>
      </div>
      <script>
        (function () {
          var w = globalThis;
          w.__CF_BENCH__ = w.__CF_BENCH__ || {};
          var media = (w.__CF_BENCH__.media = w.__CF_BENCH__.media || { ready: false });
          var listNode = document.getElementById('media-list');
          var playerNode = document.getElementById('media-player');
          var nextNode = document.getElementById('media-next');
          var items = [];
          var selected = 0;

          function renderPlayer() {
            var item = items[selected];
            if (!item) {
              playerNode.textContent = 'Select a media item.';
              return;
            }

            playerNode.innerHTML =
              '<div><strong>' + item.title + '</strong></div>' +
              '<div class="small muted">' + item.channel + ' • ' + item.publishedISO + '</div>' +
              '<p class="muted">' + item.description + '</p>';
            media.currentId = item.id;
          }

          function openAt(index) {
            var started = performance.now();
            selected = index;
            renderPlayer();
            requestAnimationFrame(function () {
              media.openDurationMs = Math.max(1, performance.now() - started);
              media.ready = true;
            });
          }

          function nextItem() {
            if (!items.length) return;
            var started = performance.now();
            selected = (selected + 1) % items.length;
            renderPlayer();
            requestAnimationFrame(function () {
              media.nextDurationMs = Math.max(1, performance.now() - started);
              media.ready = true;
            });
          }

          nextNode.addEventListener('click', nextItem);
          fetch('/api/media?pageSize=${BENCH_MEDIA_PAGE_SIZE}')
            .then(function (res) { return res.json(); })
            .then(function (payload) {
              items = Array.isArray(payload && payload.results) ? payload.results : [];
              listNode.innerHTML = '';
              for (var i = 0; i < items.length; i++) {
                (function (index) {
                  var item = items[index];
                  var btn = document.createElement('button');
                  btn.className = 'btn';
                  btn.setAttribute('data-testid', 'media-card');
                  btn.style.textAlign = 'left';
                  btn.innerHTML =
                    '<div><strong>' + item.title + '</strong></div>' +
                    '<div class="small muted">' + item.channel + '</div>';
                  btn.addEventListener('click', function () { openAt(index); });
                  listNode.appendChild(btn);
                })(i);
              }

              if (!items.length) {
                listNode.innerHTML = '<div class="muted">No media.</div>';
              } else {
                renderPlayer();
              }

              media.ready = true;
            })
            .catch(function (error) {
              listNode.innerHTML = '<div class="muted">Failed to load media.</div>';
              media.ready = true;
              media.error = true;
              media.errorMessage = error && error.message ? error.message : String(error);
            });
        })();
      </script>
    `
  );
}

function matchHonoPage(pathname: string): HonoPageMatch | null {
  pathname = pathname.replace(/\/+$/, "") || "/";
  if (pathname === "/") return { page: "home" };
  if (pathname === "/stays") return { page: "stays" };
  if (pathname === "/blog") return { page: "blog" };
  if (pathname === "/chart") return { page: "chart" };
  if (pathname === "/media") return { page: "media" };
  const stay = pathname.match(/^\/stays\/([^/]+)$/);
  if (stay) return { page: "stay", id: stay[1] };
  const blog = pathname.match(/^\/blog\/([^/]+)$/);
  if (blog) return { page: "post", slug: blog[1] };
  return null;
}

function renderHonoPage(input: URL | Request | string) {
  const url = toUrl(input);
  const match = matchHonoPage(url.pathname);
  if (!match) return null;

  switch (match.page) {
    case "home":
      return homePage();
    case "stays":
      return staysPage(url);
    case "stay":
      return stayDetailPage(match.id);
    case "blog":
      return blogPage();
    case "post":
      return blogPostPage(match.slug);
    case "chart":
      return chartPage();
    case "media":
      return mediaPage();
    default:
      return null;
  }
}

function pageCacheControl(pathname: string) {
  pathname = pathname.replace(/\/+$/, "") || "/";
  if (pathname === "/stays" || pathname === "/blog") return CACHE.short;
  if (/^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname)) return CACHE.detail;
  return CACHE.noStore;
}

export function handleHonoPageRequest(request: Request) {
  const url = toUrl(request);
  if (request.method.toUpperCase() !== "GET") return null;

  const html = renderHonoPage(url);
  if (!html) return null;

  const headers = withServerTiming(null, performance.now());
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", pageCacheControl(url.pathname));
  return new Response(html, { status: 200, headers });
}
