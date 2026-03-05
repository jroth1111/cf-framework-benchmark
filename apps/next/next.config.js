// @ts-check
const BENCH_PROFILE_HEADER = "x-cf-bench-profile";
const BENCH_CACHE_LIST = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const BENCH_CACHE_DETAIL = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";
const BENCH_CACHE_PROFILES = ["idiomatic", "mobile-cold"];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const cacheRules = BENCH_CACHE_PROFILES.flatMap((profile) => ([
      {
        source: "/stays",
        has: [{ type: "header", key: BENCH_PROFILE_HEADER, value: profile }],
        headers: [{ key: "Cache-Control", value: BENCH_CACHE_LIST }],
      },
      {
        source: "/stays/:path+",
        has: [{ type: "header", key: BENCH_PROFILE_HEADER, value: profile }],
        headers: [{ key: "Cache-Control", value: BENCH_CACHE_DETAIL }],
      },
      {
        source: "/blog",
        has: [{ type: "header", key: BENCH_PROFILE_HEADER, value: profile }],
        headers: [{ key: "Cache-Control", value: BENCH_CACHE_LIST }],
      },
      {
        source: "/blog/:path+",
        has: [{ type: "header", key: BENCH_PROFILE_HEADER, value: profile }],
        headers: [{ key: "Cache-Control", value: BENCH_CACHE_DETAIL }],
      },
    ]));

    const parityRules = [
      {
        source: "/stays",
        has: [{ type: "header", key: BENCH_PROFILE_HEADER, value: "parity" }],
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/stays/:path+",
        has: [{ type: "header", key: BENCH_PROFILE_HEADER, value: "parity" }],
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/blog",
        has: [{ type: "header", key: BENCH_PROFILE_HEADER, value: "parity" }],
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/blog/:path+",
        has: [{ type: "header", key: BENCH_PROFILE_HEADER, value: "parity" }],
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];

    return [
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      ...cacheRules,
      ...parityRules,
      {
        source: "/",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/chart",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
  experimental: {
    // Keep builds simple for the benchmark harness.
  },
};

export default nextConfig;
