import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  experimental: {
    // Keep builds simple for benchmark harness
  },
};

export default nextConfig;

// Enable Cloudflare bindings for `next dev`
initOpenNextCloudflareForDev();
