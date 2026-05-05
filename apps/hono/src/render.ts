import {
  blogPosts,
  chartSymbols,
  getListing,
  getPost,
  queryListings,
} from "@cf-bench/dataset";

const CACHE = {
  noStore: "no-store",
  short: "public, max-age=0, s-maxage=60",
  detail: "public, max-age=0, s-maxage=300",
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
      :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #f7f9fc; color: #16202a; }
      a { color: #0f3d7a; text-decoration: none; }
      .container { width: min(1100px, calc(100% - 32px)); margin: 0 auto; }
      .nav { display: flex; gap: 14px; align-items: center; padding: 14px 0; }
      .nav a { padding: 8px 12px; background: #fff; border: 1px solid #d7dde7; border-radius: 999px; }
      .brand { font-weight: 700; }
      .card { background: #fff; border: 1px solid #d7dde7; border-radius: 12px; padding: 14px; }
      .grid { display: grid; gap: 12px; }
      .grid.cols-2 { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
      .grid.cols-3 { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
      .muted { color: #5c6b7a; }
      .small { font-size: 12px; }
      .h1 { margin: 8px 0 14px; font-size: 30px; line-height: 1.2; }
      .pill { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border: 1px solid #d7dde7; border-radius: 999px; background: #fff; }
      .btn { cursor: pointer; border: 1px solid #d7dde7; border-radius: 10px; padding: 10px 12px; background: #fff; }
      .input { border: 1px solid #c9d2df; border-radius: 8px; padding: 8px 10px; background: #fff; }
      .footer { margin: 22px 0 36px; font-size: 12px; color: #5c6b7a; }
      canvas { background: #0f1620; display: block; width: 100%; height: 100%; border-radius: 12px; border: 1px solid #d7dde7; }
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
      <a class="brand" href="/">CF Bench (hono)</a>
      <a href="/stays">Stays</a>
      <a href="/chart">Chart</a>
      <a href="/media">Media</a>
      <a href="/blog">Blog</a>
    </header>
    <main class="container">
      ${body}
      <div class="footer">Hono benchmark route surface rendered directly in the Worker runtime.</div>
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
    "hono benchmark",
    `
      <h1 class="h1">Framework benchmark harness</h1>
      <div class="grid cols-3">
        <div class="card"><h2>MPA listing flow</h2><p class="muted">Listing index + detail routes.</p><p><a class="pill" href="/stays">Open stays</a></p></div>
        <div class="card"><h2>SPA chart flow</h2><p class="muted">Interactive chart controls + canvas.</p><p><a class="pill" href="/chart">Open chart</a></p></div>
        <div class="card"><h2>Media feed flow</h2><p class="muted">Open + next interactions with markers.</p><p><a class="pill" href="/media">Open media</a></p></div>
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
    <a class="card" data-testid="stay-card" href="/stays/${esc(listing.id)}">
      <div style="font-weight:700">${esc(listing.title)}</div>
      <div class="small muted">${esc(listing.city)}, ${esc(listing.country)} • ${esc(listing.bedrooms)} bd • ${esc(listing.baths)} ba</div>
      <div style="margin-top:8px"><strong>$${esc(listing.pricePerNight)}</strong> <span class="muted small">/ night</span></div>
    </a>`
    )
    .join("");

  return shell(
    "Stays",
    `
      <h1 class="h1">Stays</h1>
      <p class="muted">Airbnb-style listing index.</p>
      <div class="grid cols-2" style="margin-top:12px">${cards}</div>
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
              <option value="1m">1m</option>
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="1h" selected>1h</option>
              <option value="4h">4h</option>
              <option value="1d">1d</option>
            </select>
          </label>
          <label class="small muted"><input type="checkbox" checked /> SMA20</label>
          <label class="small muted"><input type="checkbox" /> SMA50</label>
          <label class="small muted"><input type="checkbox" /> EMA20</label>
          <label class="small muted"><input type="checkbox" checked /> Volume</label>
        </div>
        <div style="height:420px; margin-top:12px">
          <canvas data-testid="chart-canvas" width="1200" height="420"></canvas>
        </div>
      </div>
      <script>
        (function () {
          var w = globalThis;
          w.__CF_BENCH__ = w.__CF_BENCH__ || {};
          var chart = (w.__CF_BENCH__.chart = w.__CF_BENCH__.chart || {});
          var core = (w.__CF_BENCH__.chartCore = w.__CF_BENCH__.chartCore || {});
          var canvas = document.querySelector('[data-testid="chart-canvas"]');
          var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
          var symbol = document.querySelector('[data-testid="symbol-select"]');
          var timeframe = document.querySelector('[data-testid="timeframe-select"]');

          function draw() {
            var started = performance.now();
            if (ctx && canvas) {
              var width = canvas.width;
              var height = canvas.height;
              ctx.clearRect(0, 0, width, height);
              ctx.fillStyle = '#0f1620';
              ctx.fillRect(0, 0, width, height);
              var bars = 90;
              for (var i = 0; i < bars; i++) {
                var x = (i * width) / bars;
                var base = Math.sin(i / 5) * 28 + Math.cos(i / 9) * 18;
                var open = height / 2 + base;
                var close = open + (Math.random() - 0.5) * 26;
                var high = Math.min(open, close) - (6 + Math.random() * 10);
                var low = Math.max(open, close) + (6 + Math.random() * 10);
                ctx.strokeStyle = close >= open ? '#2ed273' : '#ef5d5d';
                ctx.beginPath();
                ctx.moveTo(x + 4, high);
                ctx.lineTo(x + 4, low);
                ctx.stroke();
                ctx.fillStyle = close >= open ? '#2ed273' : '#ef5d5d';
                ctx.fillRect(x + 1, Math.min(open, close), 6, Math.max(2, Math.abs(close - open)));
              }
            }

            requestAnimationFrame(function () {
              core.lastDrawMs = Math.max(1, performance.now() - started);
              chart.ready = true;
            });
          }

          function switchSymbol() {
            var started = performance.now();
            draw();
            requestAnimationFrame(function () {
              chart.switchDurationMs = Math.max(1, performance.now() - started);
              chart.symbol = symbol ? symbol.value : 'BTC';
              chart.timeframe = timeframe ? timeframe.value : '1h';
              chart.ready = true;
            });
          }

          if (symbol) symbol.addEventListener('change', switchSymbol);
          if (timeframe) timeframe.addEventListener('change', switchSymbol);

          draw();
          chart.switchDurationMs = chart.switchDurationMs || 1;
          chart.symbol = symbol ? symbol.value : 'BTC';
          chart.timeframe = timeframe ? timeframe.value : '1h';
        })();
      </script>
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
          fetch('/api/media?pageSize=30')
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
