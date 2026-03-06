export const CACHE = Object.freeze({
  noStore: "no-store",
  short: "public, max-age=0, s-maxage=60",
  detail: "public, max-age=0, s-maxage=300",
});

export function toUrl(input) {
  if (input instanceof URL) return input;
  if (input instanceof Request) return new URL(input.url);
  if (input && typeof input === "object" && typeof input.url === "string") {
    return new URL(input.url);
  }
  if (typeof input === "string") return new URL(input, "https://cf-bench.local");
  return new URL("https://cf-bench.local");
}

function getIsolateId() {
  const g = globalThis;
  if (!g.__CF_BENCH_ISOLATE_ID) {
    g.__CF_BENCH_ISOLATE_ID = crypto.randomUUID();
  }
  return g.__CF_BENCH_ISOLATE_ID;
}

export function withServerTiming(headers, start) {
  const h = new Headers(headers || {});
  const dur = typeof start === "number" ? performance.now() - start : null;
  if (!h.has("server-timing")) {
    if (dur == null) {
      h.set("server-timing", `cf_bench;desc="${getIsolateId()}"`);
    } else {
      h.set("server-timing", `cf_bench;dur=${dur.toFixed(1)};desc="${getIsolateId()}"`);
    }
  }
  return h;
}

export function parseIntParam(value, fallback) {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
