import { defineConfig } from "vite";
import honox from "honox/vite";
import build from "@hono/vite-build/cloudflare-workers";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@cf-bench/dataset": path.resolve(rootDir, "../../packages/dataset/src/index.js"),
			"@cf-bench/bench-contract": path.resolve(rootDir, "../../packages/bench-contract/src/index.js"),
			"@cf-bench/bench-types": path.resolve(rootDir, "../../packages/bench-types/src/index.ts"),
		},
	},
	plugins: [honox(), build()],
});
