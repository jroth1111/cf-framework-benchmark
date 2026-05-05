import type React from "react";

import { BENCH_MEDIA_PAGE_SIZE, blogPosts, chartSymbols, chartTimeframes, getListing, getPost, queryListings, queryMedia } from "../../../../packages/dataset/src/index.js";
import { route, type Route } from "rwsdk/router";

type PageProps = {
  params: Record<string, string | undefined>;
  response: ResponseInit & { headers: Headers };
  rw: { nonce: string };
};

function formatJson(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function InlineScript({ code, nonce }: { code: string; nonce: string }) {
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: code }} />;
}

function Shell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <>
      <header className="top-nav">
        <a className="brand" href="/">CF Bench</a>
        <nav className="nav-pills" aria-label="Benchmark routes">
          <a className="pill" href="/stays">Stays</a>
          <a className="pill" href="/chart">Chart</a>
          <a className="pill" href="/media">Media</a>
          <a className="pill" href="/blog">Blog</a>
        </nav>
      </header>
      <section className="section">{children}</section>
    </>
  );
}

function HomePage() {
  return (
    <Shell title="Cloudflare Framework Benchmark">
      <h1 className="h1">Cloudflare Framework Benchmark</h1>
      <div className="grid cols-3">
        <a className="card feature-card" href="/stays">
          <strong>Listing flow</strong>
          <p className="muted">Server-rendered stays index and detail routes with cache-aware HTML.</p>
        </a>
        <a className="card feature-card" href="/chart">
          <strong>Chart flow</strong>
          <p className="muted">Interactive controls with raw HTML selectors for client benchmark hooks.</p>
        </a>
        <a className="card feature-card" href="/media">
          <strong>Media flow</strong>
          <p className="muted">Pre-rendered feed cards and player controls with native route ownership.</p>
        </a>
      </div>
    </Shell>
  );
}

function StaysPage() {
  const listings = queryListings({ page: 1, pageSize: 12 }).results;

  return (
    <Shell title="Stays">
      <h1 className="h1">Stays</h1>
      <p className="muted">Airbnb-style listing index served on Cloudflare Workers.</p>
      <div className="grid cols-3">
        {listings.map((listing) => (
          <a key={listing.id} className="card stay-card" data-testid="stay-card" href={`/stays/${listing.id}`}>
            <div className="stay-meta">
              <span className="muted small">
                {listing.city}, {listing.country} • {listing.bedrooms} bd • {listing.baths} ba • up to {listing.maxGuests} guests
              </span>
            </div>
            <strong>{listing.title}</strong>
            <div className="price-row">
              <span className="price">{formatUsd(listing.pricePerNight)}</span>
              <span className="muted small">/ night</span>
            </div>
            <div className="muted small">★ {listing.rating} ({listing.reviews} reviews)</div>
            <p className="muted">{listing.summary}</p>
          </a>
        ))}
      </div>
    </Shell>
  );
}

function StayDetailPage({ params, response }: PageProps) {
  const listing = getListing(params.id ?? "");
  if (!listing) {
    response.status = 404;
    return (
      <Shell title="Stay not found">
        <div className="card">
          <p className="muted">Unknown listing.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={listing.title}>
      <a className="pill" href="/stays">
        Back to stays
      </a>
      <div className="section stack">
        <div className="card">
          <p className="muted small">
            {listing.city}, {listing.country} • {listing.neighborhood}
          </p>
          <div data-testid="stay-description" dangerouslySetInnerHTML={{ __html: listing.descriptionHtml }} />
        </div>
      </div>
    </Shell>
  );
}

function BlogPage() {
  return (
    <Shell title="Blog">
      <div className="grid cols-2">
        {blogPosts.map((post) => (
          <a key={post.slug} className="card blog-card" data-testid="blog-post-card" href={`/blog/${post.slug}`}>
            <strong>{post.title}</strong>
            <p className="muted small">
              {post.dateISO} • {post.readingMinutes} min read
            </p>
            <p className="muted">{post.excerpt}</p>
          </a>
        ))}
      </div>
    </Shell>
  );
}

function BlogPostPage({ params, response }: PageProps) {
  const post = getPost(params.slug ?? "");
  if (!post) {
    response.status = 404;
    return (
      <Shell title="Post not found">
        <div className="card">
          <p className="muted">Unknown post.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={post.title}>
      <a className="pill" href="/blog">
        Back to blog
      </a>
      <div className="section stack">
        <p className="muted small">
          {post.dateISO} • {post.readingMinutes} min read
        </p>
        <article className="card rich-html" data-testid="blog-html" dangerouslySetInnerHTML={{ __html: post.html }} />
      </div>
    </Shell>
  );
}

function ChartPage({ rw }: PageProps) {
  const symbolOptions = chartSymbols.map((symbol) => (
    <option key={symbol} value={symbol}>
      {symbol}
    </option>
  ));

  return (
    <Shell title="Chart">
      <div className="card stack">
        <div className="toolbar">
          <label className="control">
            <span className="muted small">Symbol</span>
            <select className="control-select" data-testid="symbol-select" defaultValue="BTC">
              {symbolOptions}
            </select>
          </label>
          <label className="control">
            <span className="muted small">Timeframe</span>
            <select className="control-select" data-testid="timeframe-select" defaultValue="1h">
              {chartTimeframes.map((timeframe) => (
                <option key={timeframe} value={timeframe}>
                  {timeframe}
                </option>
              ))}
            </select>
          </label>
          <label className="muted small">
            <input data-testid="ind-sma20" data-chart-indicator="sma20" type="checkbox" defaultChecked /> SMA20
          </label>
          <label className="muted small">
            <input data-testid="ind-sma50" data-chart-indicator="sma50" type="checkbox" /> SMA50
          </label>
          <label className="muted small">
            <input data-testid="ind-ema20" data-chart-indicator="ema20" type="checkbox" /> EMA20
          </label>
          <label className="muted small">
            <input data-testid="ind-volume" data-chart-indicator="volume" type="checkbox" defaultChecked /> Volume
          </label>
          <span className="muted small" data-testid="chart-status">
            Loading candles...
          </span>
        </div>
        <canvas className="chart-canvas" data-testid="chart-canvas" width="1200" height="420" />
      </div>
      <script nonce={rw.nonce} type="module" src="/assets/chart-client.js" />
    </Shell>
  );
}

function MediaPage({ rw }: PageProps) {
  const mediaItems = queryMedia({ page: 1, pageSize: BENCH_MEDIA_PAGE_SIZE }).results;
  const initialItem = mediaItems[0] ?? null;

  const mediaScript = `
const items = ${formatJson(mediaItems)};
const bench = (globalThis.__CF_BENCH__ = globalThis.__CF_BENCH__ || {});
const media = (bench.media = bench.media || { ready: false });
const listNode = document.getElementById('media-list');
const playerNode = document.getElementById('media-player');
const nextNode = document.getElementById('media-next');
let selected = 0;
function renderPlayer() {
  const item = items[selected];
  if (!item || !playerNode) return;
  playerNode.innerHTML =
    '<img class="player-image" src="' + item.thumbnail + '" alt="' + item.title.replaceAll('"', '&quot;') + '" loading="eager" decoding="async" fetchpriority="high">' +
    '<div><strong>' + item.title + '</strong></div>' +
    '<div class="muted small">' + item.channel + ' • ' + item.publishedISO + '</div>' +
    '<p class="muted">' + item.description + '</p>';
  media.currentId = item.id;
}
function openAt(index) {
  const started = performance.now();
  selected = index;
  renderPlayer();
  requestAnimationFrame(() => {
    media.openDurationMs = Math.max(1, performance.now() - started);
    media.ready = true;
  });
}
function nextItem() {
  if (!items.length) return;
  const started = performance.now();
  selected = (selected + 1) % items.length;
  renderPlayer();
  requestAnimationFrame(() => {
    media.nextDurationMs = Math.max(1, performance.now() - started);
    media.ready = true;
  });
}
if (listNode) {
  for (const button of listNode.querySelectorAll('[data-media-index]')) {
    button.addEventListener('click', () => openAt(Number(button.getAttribute('data-media-index') || '0')));
  }
}
nextNode && nextNode.addEventListener('click', nextItem);
media.currentId = items[0]?.id || null;
media.ready = true;
`;

  return (
    <Shell title="Media">
      <div className="grid cols-2 media-grid">
        <div className="card">
          <h2>Feed</h2>
          <div id="media-list" className="stack">
            {mediaItems.map((item, index) => (
              <button
                key={item.id}
                className="media-card"
                data-testid="media-card"
                data-media-index={index}
                type="button"
              >
                <strong>{item.title}</strong>
                <span className="muted small">{item.channel}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="card stack">
          <h2>Player</h2>
          <div className="media-player" data-testid="media-player" id="media-player">
            {initialItem ? (
              <>
                <img
                  className="player-image"
                  src={initialItem.thumbnail}
                  alt={initialItem.title}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                />
                <div>
                  <strong>{initialItem.title}</strong>
                </div>
                <div className="muted small">
                  {initialItem.channel} • {initialItem.publishedISO}
                </div>
                <p className="muted">{initialItem.description}</p>
              </>
            ) : (
              "Select a media item."
            )}
          </div>
          <button className="pill action-pill" data-testid="media-next" id="media-next" type="button">
            Next
          </button>
        </div>
      </div>
      <InlineScript nonce={rw.nonce} code={mediaScript} />
    </Shell>
  );
}

export const routes: Route[] = [
  route("/", HomePage),
  route("/stays", StaysPage),
  route("/stays/:id", StayDetailPage),
  route("/blog", BlogPage),
  route("/blog/:slug", BlogPostPage),
  route("/chart", ChartPage),
  route("/media", MediaPage),
];
