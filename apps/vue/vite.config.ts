import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vite.dev/config/
export default defineConfig({
	plugins: [vue()],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
			"@cf-bench/dataset": fileURLToPath(new URL("../../packages/dataset/src/index.js", import.meta.url)),
			"@cf-bench/chart-core": fileURLToPath(new URL("../../packages/chart-core/src/index.js", import.meta.url)),
			"@cf-bench/bench-types": fileURLToPath(new URL("../../packages/bench-types/src/index.ts", import.meta.url)),
			"@cf-bench/ui/styles.css": fileURLToPath(new URL("../../packages/ui/src/styles.css", import.meta.url)),
		},
	},
	build: {
		outDir: "dist",
		emptyOutDir: true,
	},
});
