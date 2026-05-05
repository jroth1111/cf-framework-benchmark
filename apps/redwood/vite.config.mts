import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { redwood } from "rwsdk/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    babel({
      filter: /\.[jt]sx?$/,
      babelConfig: {
        babelrc: false,
        configFile: false,
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    react(),
    cloudflare({
      viteEnvironment: { name: "worker" },
    }),
    redwood(),
  ],
});
