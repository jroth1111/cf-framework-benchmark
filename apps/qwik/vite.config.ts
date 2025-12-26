import { defineConfig } from "vite";
import { qwikCity } from "@qwik.dev/router/vite";
import { qwikVite } from "@qwik.dev/core/optimizer";
import { cloudflarePagesAdapter } from "@qwik.dev/router/adapters/cloudflare-pages/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command }) => {
  const isCloudflare = process.env.CF_TARGET === "cloudflare";
  const isBuild = command === "build";
  const buildTarget = process.env.QWIK_BUILD_TARGET || "client";
  const isSsrBuild = isBuild && isCloudflare && buildTarget === "ssr";

  return {
    plugins: [
      tsconfigPaths({ projects: ["./tsconfig.json"] }),
      qwikCity({ trailingSlash: false }),
      qwikVite({
        ssr: {
          input: "src/entry.cloudflare-pages.tsx",
          manifestInputPath: "dist/q-manifest.json",
        },
      }),
      ...(isSsrBuild ? [cloudflarePagesAdapter()] : []),
    ],
    build: isSsrBuild
      ? {
          ssr: true,
          rollupOptions: {
            input: {
              "entry.cloudflare-pages": "src/entry.cloudflare-pages.tsx",
            },
            output: {
              inlineDynamicImports: false,
            },
          },
        }
      : undefined,
  };
});
