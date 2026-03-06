import type React from "react";

import { blogPosts, chartSymbols, getListing, getPost, queryListings, queryMedia } from "../../../../packages/dataset/src/index.js";
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
      <section className="hero card">
        <p className="eyebrow">Cloudflare Workers benchmark</p>
        <h1>{title}</h1>
      </section>
      <nav className="section nav-pills" aria-label="Benchmark routes">
        <a className="pill" href="/">
          Overview
        </a>
        <a className="pill" href="/stays">
          Stays
        </a>
        <a className="pill" href="/blog">
          Blog
        </a>
        <a className="pill" href="/chart">
          Chart
        </a>
        <a className="pill" href="/media">
          Media
        </a>
      </nav>
      <section className="section">{children}</section>
    </>
  );
}

function HomePage() {
  return (
    <Shell title="Redwood benchmark routes">
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
      <div className="grid cols-2">
        {listings.map((listing) => (
          <a key={listing.id} className="card stay-card" data-testid="stay-card" href={`/stays/${listing.id}`}>
            <div className="stay-meta">
              <span className="pill-pill">{listing.city}</span>
              <span className="muted small">
                {listing.country} • {listing.bedrooms} bd • {listing.baths} ba
              </span>
            </div>
            <strong>{listing.title}</strong>
            <p className="muted">{listing.summary}</p>
            <div className="price-row">
              <span className="price">${listing.pricePerNight}</span>
              <span className="muted small">nightly</span>
            </div>
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

  const chartScript = `
const bench = (globalThis.__CF_BENCH__ = globalThis.__CF_BENCH__ || {});
const chart = (bench.chart = bench.chart || { ready: false });
const core = (bench.chartCore = bench.chartCore || {});
const canvas = document.querySelector('[data-testid="chart-canvas"]');
const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
const symbol = document.querySelector('[data-testid="symbol-select"]');
const timeframe = document.querySelector('[data-testid="timeframe-select"]');
function draw() {
  const started = performance.now();
  if (!ctx || !canvas) return;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#081320';
  ctx.fillRect(0, 0, width, height);
  const bars = 90;
  for (let i = 0; i < bars; i += 1) {
    const x = (i * width) / bars;
    const base = Math.sin(i / 5) * 26 + Math.cos(i / 8) * 18;
    const open = height / 2 + base;
    const close = open + (Math.sin(i / 3) * 18);
    const high = Math.min(open, close) - 8;
    const low = Math.max(open, close) + 8;
    ctx.strokeStyle = close >= open ? '#39d98a' : '#ff6b6b';
    ctx.beginPath();
    ctx.moveTo(x + 4, high);
    ctx.lineTo(x + 4, low);
    ctx.stroke();
    ctx.fillStyle = close >= open ? '#39d98a' : '#ff6b6b';
    ctx.fillRect(x + 1, Math.min(open, close), 6, Math.max(3, Math.abs(close - open)));
  }
  requestAnimationFrame(() => {
    core.lastDrawMs = Math.max(1, performance.now() - started);
    chart.ready = true;
  });
}
function update() {
  const started = performance.now();
  draw();
  requestAnimationFrame(() => {
    chart.switchDurationMs = Math.max(1, performance.now() - started);
    chart.symbol = symbol ? symbol.value : 'BTC';
    chart.timeframe = timeframe ? timeframe.value : '1h';
    chart.ready = true;
  });
}
symbol && symbol.addEventListener('change', update);
timeframe && timeframe.addEventListener('change', update);
draw();
chart.symbol = symbol ? symbol.value : 'BTC';
chart.timeframe = timeframe ? timeframe.value : '1h';
chart.switchDurationMs = chart.switchDurationMs || 1;
`;

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
              <option value="1m">1m</option>
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="1h">1h</option>
              <option value="4h">4h</option>
              <option value="1d">1d</option>
            </select>
          </label>
        </div>
        <canvas className="chart-canvas" data-testid="chart-canvas" width="1200" height="420" />
      </div>
      <InlineScript nonce={rw.nonce} code={chartScript} />
    </Shell>
  );
}

function MediaPage({ rw }: PageProps) {
  const mediaItems = queryMedia({ page: 1, pageSize: 18 }).results;

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
renderPlayer();
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
            Select a media item.
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
