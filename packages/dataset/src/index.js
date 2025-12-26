/**
 * Shared dataset used across all framework implementations.
 *
 * Goals:
 * - Keep content & data identical, so framework differences are more visible.
 * - Everything must be runtime-safe for Cloudflare Workers (no Node-only APIs).
 * - Deterministic outputs for benchmark repeatability.
 */

/**
 * @typedef {{
 *  name: string;
 *  dateISO: string;
 *  rating: number;
 *  text: string;
 * }} Review
 */

/**
 * @typedef {{
 *  id: string;
 *  title: string;
 *  city: string;
 *  country: string;
 *  neighborhood: string;
 *  lat: number;
 *  lng: number;
 *  pricePerNight: number;
 *  cleaningFee: number;
 *  serviceFee: number;
 *  rating: number;
 *  reviews: number;
 *  reviewSamples: Review[];
 *  maxGuests: number;
 *  bedrooms: number;
 *  baths: number;
 *  tags: string[];
 *  amenities: string[];
 *  hostName: string;
 *  hostSinceISO: string;
 *  superhost: boolean;
 *  summary: string;
 *  descriptionHtml: string;
 * }} Listing
 */

/** @typedef {{ slug: string; title: string; dateISO: string; readingMinutes: number; excerpt: string; tags: string[]; html: string; }} BlogPost */
/** @typedef {{ t: number; o: number; h: number; l: number; c: number; v: number }} Candle */

/** Deterministic string->seed. */
function hashStringToSeed(str) {
  // FNV-1a-ish 32-bit
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {number} value */
export function formatUsd(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

const cities = [
  { city: 'San Francisco', country: 'United States', neighborhoods: ['SoMa', 'Mission', 'Noe Valley', 'Richmond'] },
  { city: 'New York', country: 'United States', neighborhoods: ['Williamsburg', 'SoHo', 'Upper West Side', 'East Village'] },
  { city: 'Austin', country: 'United States', neighborhoods: ['Zilker', 'East Austin', 'Mueller', 'Travis Heights'] },
  { city: 'Seattle', country: 'United States', neighborhoods: ['Capitol Hill', 'Ballard', 'Fremont', 'Queen Anne'] },
  { city: 'Miami', country: 'United States', neighborhoods: ['Wynwood', 'Brickell', 'South Beach', 'Coconut Grove'] },
  { city: 'Denver', country: 'United States', neighborhoods: ['RiNo', 'LoHi', 'Capitol Hill', 'Baker'] },
  { city: 'Chicago', country: 'United States', neighborhoods: ['Wicker Park', 'Logan Square', 'Loop', 'Hyde Park'] },
  { city: 'Boston', country: 'United States', neighborhoods: ['Back Bay', 'Cambridge', 'South End', 'Seaport'] },
  { city: 'Lisbon', country: 'Portugal', neighborhoods: ['Alfama', 'Príncipe Real', 'Bairro Alto', 'Belém'] },
  { city: 'Barcelona', country: 'Spain', neighborhoods: ['Eixample', 'El Born', 'Gràcia', 'Poblenou'] },
];

const tagPool = ['Entire home', 'Wifi', 'Kitchen', 'Workspace', 'Washer', 'Dryer', 'Pet friendly', 'Parking', 'Pool', 'Hot tub'];
const amenityPool = [
  'Air conditioning',
  'Heating',
  'Fast wifi',
  'Dedicated workspace',
  'Kitchen',
  'Coffee maker',
  'Dishwasher',
  'Washer/Dryer',
  'Gym',
  'Pool',
  'Free parking',
  'EV charger',
  'Self check-in',
  'Smart TV',
  'Balcony',
  'Outdoor dining',
  'Pet friendly',
  'Crib',
  'High chair',
];

const hostNames = [
  'Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Jamie', 'Avery', 'Cameron',
  'Drew', 'Parker', 'Reese', 'Rowan', 'Sage', 'Skyler',
];

function pickUnique(rand, pool, n) {
  const safeN = Math.min(n, pool.length);
  const out = [];
  const used = new Set();
  while (out.length < safeN) {
    const t = pool[Math.floor(rand() * pool.length)];
    if (!used.has(t)) {
      used.add(t);
      out.push(t);
    }
  }
  return out;
}

function makeReviews(rand, count) {
  const out = [];
  const baseTs = Date.UTC(2025, 0, 1, 0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const name = hostNames[Math.floor(rand() * hostNames.length)];
    const daysAgo = 7 + Math.floor(rand() * 365);
    const dateISO = new Date(baseTs - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const rating = Math.round((3.8 + rand() * 1.2) * 10) / 10;
    const snippets = [
      'Clean, quiet, and exactly as described.',
      'Great location. Would stay again.',
      'Fast wifi and a comfy bed—perfect for a work trip.',
      'The kitchen was stocked and the check-in was smooth.',
      'Loved the neighborhood. Easy transit and great food nearby.',
      'A few minor quirks, but overall a solid value.',
    ];
    const text = snippets[Math.floor(rand() * snippets.length)];
    out.push({ name, dateISO, rating, text });
  }
  return out;
}

/** @type {Listing[]} */
export const listings = (() => {
  const out = [];
  for (let i = 1; i <= 60; i++) {
    const id = String(i).padStart(3, '0');
    const seed = hashStringToSeed('listing:' + id);
    const rand = mulberry32(seed);
    const loc = cities[Math.floor(rand() * cities.length)];
    const neighborhood = loc.neighborhoods[Math.floor(rand() * loc.neighborhoods.length)];

    const base = 110 + Math.floor(rand() * 420);
    const cleaningFee = 20 + Math.floor(rand() * 90);
    const serviceFee = Math.floor(base * (0.08 + rand() * 0.06));

    const rating = Math.round((4.0 + rand() * 0.9) * 10) / 10;
    const reviews = 30 + Math.floor(rand() * 1100);
    const bedrooms = 1 + Math.floor(rand() * 4);
    const baths = 1 + Math.floor(rand() * 3);
    const maxGuests = bedrooms * 2 + (rand() > 0.65 ? 2 : 0);

    const tags = pickUnique(rand, tagPool, 3 + Math.floor(rand() * 3));
    const amenities = pickUnique(rand, amenityPool, 7 + Math.floor(rand() * 6));

    const titleVariants = ['Sunny loft', 'Modern studio', 'Cozy bungalow', 'Design apartment', 'Quiet retreat', 'Spacious home', 'Minimalist flat', 'Historic townhouse'];
    const title = `${titleVariants[Math.floor(rand() * titleVariants.length)]} in ${neighborhood}`;
    const summary = `A ${bedrooms}-bed / ${baths}-bath stay for up to ${maxGuests} guests. Great for work + weekend exploring.`;

    const hostName = hostNames[Math.floor(rand() * hostNames.length)];
    const hostSinceYear = 2015 + Math.floor(rand() * 10);
    const hostSinceISO = `${hostSinceYear}-0${1 + Math.floor(rand() * 9)}-0${1 + Math.floor(rand() * 9)}`;
    const superhost = rand() > 0.72;

    const lat = 25 + rand() * 25;
    const lng = -125 + rand() * 45;

    const reviewSamples = makeReviews(rand, 5);

    const descriptionHtml = `
      <p>${summary}</p>
      <p><strong>Neighborhood:</strong> ${neighborhood}, ${loc.city}.</p>
      <p><strong>Highlights:</strong> ${tags.join(', ')}.</p>
      <h3>Amenities</h3>
      <ul>
        ${amenities.map((a) => `<li>${a}</li>`).join('')}
      </ul>
      <h3>Benchmark note</h3>
      <p>This content is intentionally consistent across frameworks so rendering + hydration differences are easier to spot.</p>
    `.trim();

    out.push({
      id,
      title,
      city: loc.city,
      country: loc.country,
      neighborhood,
      lat,
      lng,
      pricePerNight: base,
      cleaningFee,
      serviceFee,
      rating,
      reviews,
      reviewSamples,
      maxGuests,
      bedrooms,
      baths,
      tags,
      amenities,
      hostName,
      hostSinceISO,
      superhost,
      summary,
      descriptionHtml,
    });
  }
  return out;
})();

/** @param {string} id */
export function getListing(id) {
  return listings.find((l) => l.id === id);
}

/**
 * Server-ish helper used by multiple frameworks (SSR and API).
 * @param {{ city?: string; max?: number; sort?: 'relevance'|'price_asc'|'price_desc'|'rating_desc'; page?: number; pageSize?: number }} params
 */
export function queryListings(params = {}) {
  const city = params.city || '';
  const max = typeof params.max === 'number' ? params.max : null;
  const sort = params.sort || 'relevance';
  const pageSize = Math.max(1, Math.min(50, params.pageSize ?? 24));
  const page = Math.max(1, params.page ?? 1);

  let rows = listings.slice();
  if (city) rows = rows.filter((l) => l.city === city);
  if (max != null && Number.isFinite(max)) rows = rows.filter((l) => l.pricePerNight <= max);

  if (sort === 'price_asc') rows.sort((a, b) => a.pricePerNight - b.pricePerNight);
  if (sort === 'price_desc') rows.sort((a, b) => b.pricePerNight - a.pricePerNight);
  if (sort === 'rating_desc') rows.sort((a, b) => b.rating - a.rating);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(page, totalPages);
  const start = (p - 1) * pageSize;
  const end = start + pageSize;

  return {
    total,
    totalPages,
    page: p,
    pageSize,
    results: rows.slice(start, end),
  };
}

/** @type {BlogPost[]} */
export const blogPosts = (() => {
  const base = [
    {
      slug: 'why-this-benchmark-exists',
      title: 'Why this benchmark exists',
      dateISO: '2025-01-08',
      readingMinutes: 4,
      tags: ['benchmarking', 'methodology'],
      excerpt: 'A pragmatic explanation of what we are measuring (and what we are not).',
      html: `
        <p>This repo is not trying to crown a universal &quot;best&quot; framework.</p>
        <p>It gives you a repeatable way to compare:</p>
        <ul>
          <li>Load performance (TTFB-ish, LCP, CLS)</li>
          <li>Repeat views (cache + parsing + route transitions)</li>
          <li>Client CPU + memory under identical interactions</li>
        </ul>
        <p>The site is deliberately small but representative: listings, a chart, and a blog.</p>
      `.trim(),
    },
    {
      slug: 'cloudflare-edge-realities',
      title: 'Cloudflare edge realities',
      dateISO: '2025-02-19',
      readingMinutes: 6,
      tags: ['cloudflare', 'edge'],
      excerpt: 'What changes when your runtime is workerd at the edge (not Node on a VM).',
      html: `
        <p>Cloudflare Workers runs on web-standard APIs in a V8 isolate runtime.</p>
        <p>Framework adapters often rely on:</p>
        <ul>
          <li>Streaming responses</li>
          <li>Request/Response cloning semantics</li>
          <li>Edge-friendly caching patterns</li>
        </ul>
        <p>For fair comparisons, we keep data and UI constant.</p>
      `.trim(),
    },
    {
      slug: 'core-web-vitals-in-the-lab',
      title: 'Core Web Vitals in the lab',
      dateISO: '2025-03-02',
      readingMinutes: 7,
      tags: ['web-vitals', 'performance'],
      excerpt: 'How to collect vitals in synthetic runs without fooling yourself.',
      html: `
        <p>We collect CWV using the <code>web-vitals</code> library.</p>
        <p>INP is interaction-based; a lab run needs real scripted interactions to be meaningful.</p>
        <pre><code>onLCP(console.log)
onCLS(console.log)
onINP(console.log)</code></pre>
        <p>We also compute Total Blocking Time from long tasks as a lab proxy.</p>
      `.trim(),
    },
    {
      slug: 'measuring-client-cpu-and-memory',
      title: 'Measuring client CPU and memory',
      dateISO: '2025-03-11',
      readingMinutes: 6,
      tags: ['benchmarking', 'chrome'],
      excerpt: 'Synthetic does not mean useless—here is how to interpret Performance.getMetrics().',
      html: `
        <p>We use Playwright + Chromium and record CDP metrics for:</p>
        <ul>
          <li><code>JSHeapUsedSize</code> / <code>JSHeapTotalSize</code></li>
          <li><code>TaskDuration</code>, <code>ScriptDuration</code> (when available)</li>
        </ul>
        <p>Directionally useful for comparisons, but not a substitute for production RUM.</p>
      `.trim(),
    },
    {
      slug: 'ssg-ssr-and-spa-in-one-site',
      title: 'SSG, SSR, and SPA in one site',
      dateISO: '2025-04-02',
      readingMinutes: 7,
      tags: ['architecture'],
      excerpt: 'How the same product can legitimately mix rendering modes.',
      html: `
        <p>Modern sites are usually hybrid:</p>
        <ul>
          <li>Some pages must be interactive (SPA-ish)</li>
          <li>Some pages benefit from SSR (fast first paint + SEO)</li>
          <li>Some pages are perfect for SSG (blog/docs)</li>
        </ul>
        <p>This benchmark implements all three so you can test your real constraints.</p>
      `.trim(),
    },
  ];

  const extras = [];
  for (let i = 1; i <= 8; i++) {
    const slug = `notes-${String(i).padStart(2, '0')}`;
    extras.push({
      slug,
      title: `Notes #${i}: shipping fast at the edge`,
      dateISO: `2025-05-${String(2 + i).padStart(2, '0')}`,
      readingMinutes: 3 + (i % 4),
      tags: ['notes', i % 2 ? 'dx' : 'perf'],
      excerpt: 'A short, structured note used to increase the number of real pages for SSG navigation tests.',
      html: `
        <p>Short note ${i}. This post intentionally contains a few elements that impact layout and styling.</p>
        <h3>Checklist</h3>
        <ul>
          <li>Prefer caching on static routes</li>
          <li>Keep hydration scoped</li>
          <li>Measure, then optimize</li>
        </ul>
        <p><strong>Micro-snippet</strong></p>
        <pre><code>export default {
  async fetch(req, env) {
    return new Response('ok')
  }
}</code></pre>
      `.trim(),
    });
  }

  return [...base, ...extras];
})();

/** @param {string} slug */
export function getPost(slug) {
  return blogPosts.find((p) => p.slug === slug);
}

export const chartSymbols = ['BTC', 'ETH', 'SOL', 'AAPL', 'TSLA', 'NVDA', 'GOOG', 'MSFT'];
export const chartTimeframes = /** @type {const} */ (['1m', '5m', '15m', '1h', '4h', '1d']);

export function timeframeToMs(tf) {
  switch (tf) {
    case '1m': return 60 * 1000;
    case '5m': return 5 * 60 * 1000;
    case '15m': return 15 * 60 * 1000;
    case '1h': return 60 * 60 * 1000;
    case '4h': return 4 * 60 * 60 * 1000;
    case '1d': return 24 * 60 * 60 * 1000;
    default: return 60 * 60 * 1000;
  }
}

/**
 * Generate a deterministic OHLCV candle series for a symbol + timeframe.
 * @param {string} symbol
 * @param {{ points?: number; startPrice?: number; timeframe?: string }} [opts]
 * @returns {Candle[]}
 */
export function generateCandles(symbol, opts = {}) {
  const timeframe = String(opts.timeframe || '1h').toLowerCase();
  const points = opts.points ?? 360;
  const seed = hashStringToSeed(`candle:${symbol}:${timeframe}`);
  const rand = mulberry32(seed);
  const startPrice = opts.startPrice ?? (symbol === 'BTC' ? 43000 : symbol === 'ETH' ? 2300 : 120);
  let price = startPrice;
  const out = [];
  const now = Date.UTC(2025, 0, 1, 0, 0, 0, 0); // Fixed epoch for deterministic payloads.
  const stepMs = timeframeToMs(timeframe);

  const tfVol = timeframe === '1m' ? 0.002 : timeframe === '5m' ? 0.003 : timeframe === '15m' ? 0.004 : timeframe === '1h' ? 0.006 : timeframe === '4h' ? 0.008 : 0.012;

  for (let i = points - 1; i >= 0; i--) {
    const t = now - i * stepMs;
    const drift = (rand() - 0.5) * tfVol;
    const o = price;
    const c = Math.max(1, o * (1 + drift));
    const wick = tfVol * (0.6 + rand());
    const hi = Math.max(o, c) * (1 + rand() * wick);
    const lo = Math.min(o, c) * (1 - rand() * wick);
    const v = Math.floor(200 + rand() * 2000);
    out.push({ t, o, h: hi, l: lo, c, v });
    price = c;
  }
  return out;
}
