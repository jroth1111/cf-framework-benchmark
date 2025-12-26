import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  trailingSlash: "never",
  adapter: cloudflare(),
});
