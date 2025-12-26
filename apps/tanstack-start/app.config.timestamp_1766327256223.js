// app.config.ts
import { defineConfig } from "@tanstack/react-start/config";
var app_config_default = defineConfig({
  server: {
    // Cloudflare Workers preset (best-effort; adjust if the preset name changes)
    preset: "cloudflare"
  }
});
export {
  app_config_default as default
};
