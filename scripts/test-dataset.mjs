import { blogPosts, generateCandles, listings } from "../packages/dataset/src/index.js";

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
assert(listings.length === 100, `listings length expected 100, got ${listings.length}`);

const listingIds = listings.map((l) => l.id);
assert(unique(listingIds), "listing ids should be unique");
assert(listingIds.every((id) => /^\d{3}$/.test(id)), "listing ids should be 3-digit strings");

assert(Array.isArray(blogPosts), "blogPosts should be an array");
assert(blogPosts.length > 0, "blogPosts should not be empty");

const blogSlugs = blogPosts.map((p) => p.slug);
assert(unique(blogSlugs), "blog slugs should be unique");
assert(blogSlugs.every((slug) => slug && typeof slug === "string"), "blog slugs should be non-empty strings");

const candlesA = generateCandles("BTC", { timeframe: "1h", points: 120 });
const candlesB = generateCandles("BTC", { timeframe: "1h", points: 120 });
assert(candlesA.length === 120, `generateCandles length expected 120, got ${candlesA.length}`);
assert(candlesB.length === 120, `generateCandles length expected 120, got ${candlesB.length}`);

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
