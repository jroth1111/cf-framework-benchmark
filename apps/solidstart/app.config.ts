import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  middleware: "src/middleware/index.ts",
  server: {
    preset: "cloudflare_module",
  },
});
