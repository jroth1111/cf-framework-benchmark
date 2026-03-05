import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
  plugins: [
    // Cloudflare Workers integration for the server environment.
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart({
      target: "cloudflare-workers",
      customViteReactPlugin: true,
      srcDirectory: "app",
      prerender: {
        enabled: false,
      },
    }),
    react(),
  ],
});
