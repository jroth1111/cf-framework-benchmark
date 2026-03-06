import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { redwood } from "rwsdk/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    cloudflare({
      viteEnvironment: { name: "worker" },
    }),
    redwood(),
  ],
});
