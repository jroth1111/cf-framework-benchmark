import { BENCH_MEDIA_PAGE_SIZE, MAX_CANDLE_POINTS, blogPosts, generateCandles, listings, mediaItems, queryListings, queryMedia } from "../packages/dataset/src/index.js";

const failures = [];

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function unique(values) {
  return new Set(values).size === values.length;
}

assert(Array.isArray(listings), "listings should be an array");
assert(listings.length === 60, `listings length expected 60, got ${listings.length}`);

const listingIds = listings.map((l) => l.id);
assert(unique(listingIds), "listing ids should be unique");
assert(listingIds.every((id) => /^\d{3}$/.test(id)), "listing ids should be 3-digit strings");

assert(Array.isArray(blogPosts), "blogPosts should be an array");
assert(blogPosts.length > 0, "blogPosts should not be empty");

const blogSlugs = blogPosts.map((p) => p.slug);
assert(unique(blogSlugs), "blog slugs should be unique");
assert(blogSlugs.every((slug) => slug && typeof slug === "string"), "blog slugs should be non-empty strings");

assert(Array.isArray(mediaItems), "mediaItems should be an array");
assert(mediaItems.length === 120, `mediaItems length expected 120, got ${mediaItems.length}`);
assert(unique(mediaItems.map((m) => m.id)), "media ids should be unique");
assert(BENCH_MEDIA_PAGE_SIZE === 30, `BENCH_MEDIA_PAGE_SIZE expected 30, got ${BENCH_MEDIA_PAGE_SIZE}`);

const mediaPageA = queryMedia({ page: 2, pageSize: 10 });
const mediaPageB = queryMedia({ page: 2, pageSize: 10 });
assert(mediaPageA.results.length === 10, `queryMedia pageSize expected 10, got ${mediaPageA.results.length}`);
assert(
  mediaPageA.results[0]?.id === mediaPageB.results[0]?.id,
  "queryMedia should be deterministic for same params"
);

const fractionalListings = queryListings({ page: 1.9, pageSize: 2.9 });
assert(fractionalListings.page === 1, `queryListings fractional page expected 1, got ${fractionalListings.page}`);
assert(fractionalListings.pageSize === 2, `queryListings fractional pageSize expected 2, got ${fractionalListings.pageSize}`);
assert(fractionalListings.results.length === 2, `queryListings fractional pageSize results expected 2, got ${fractionalListings.results.length}`);

const clampedListings = queryListings({ page: -5, pageSize: 5000 });
assert(clampedListings.page === 1, `queryListings negative page expected 1, got ${clampedListings.page}`);
assert(clampedListings.pageSize === 50, `queryListings oversized pageSize expected 50, got ${clampedListings.pageSize}`);

const fractionalMedia = queryMedia({ page: 2.9, pageSize: 3.9 });
assert(fractionalMedia.page === 2, `queryMedia fractional page expected 2, got ${fractionalMedia.page}`);
assert(fractionalMedia.pageSize === 3, `queryMedia fractional pageSize expected 3, got ${fractionalMedia.pageSize}`);
assert(fractionalMedia.results.length === 3, `queryMedia fractional pageSize results expected 3, got ${fractionalMedia.results.length}`);

const candlesA = generateCandles("BTC", { timeframe: "1h", points: 120 });
const candlesB = generateCandles("BTC", { timeframe: "1h", points: 120 });
assert(candlesA.length === 120, `generateCandles length expected 120, got ${candlesA.length}`);
assert(candlesB.length === 120, `generateCandles length expected 120, got ${candlesB.length}`);
assert(generateCandles("BTC", { timeframe: "1h", points: 2.9 }).length === 2, "generateCandles should truncate fractional point counts");
assert(generateCandles("BTC", { timeframe: "1h", points: -10 }).length === 1, "generateCandles should clamp negative point counts to 1");
assert(generateCandles("BTC", { timeframe: "1h", points: MAX_CANDLE_POINTS + 1 }).length === MAX_CANDLE_POINTS, "generateCandles should cap oversized point counts");

const sampleIndexes = [0, Math.floor(candlesA.length / 2), candlesA.length - 1];
for (const idx of sampleIndexes) {
  const a = candlesA[idx];
  const b = candlesB[idx];
  assert(!!a && !!b, `candle sample ${idx} should exist`);
  if (!a || !b) continue;
  for (const key of ["t", "o", "h", "l", "c", "v"]) {
    assert(a[key] === b[key], `determinism mismatch at candle ${idx}.${key}`);
  }
}

if (failures.length) {
  console.error("Dataset tests failed:");
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log("Dataset tests passed.");
