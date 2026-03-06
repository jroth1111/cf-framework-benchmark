import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

function collectHtmlInputs(pagesDir: string) {
	const inputs: Record<string, string> = {};
	const walk = (dir: string) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (entry.isFile() && entry.name.endsWith(".html")) {
				const rel = path.relative(pagesDir, full).replace(/\\/g, "/");
				const key = rel.replace(/\.html$/, "").replace(/\//g, "_") || "index";
				inputs[key] = full;
			}
		}
	};
	walk(pagesDir);
	return inputs;
}

// https://vite.dev/config/
export default defineConfig(() => {
	const pagesDir = path.resolve(__dirname, "pages");
	const input = fs.existsSync(pagesDir) ? collectHtmlInputs(pagesDir) : undefined;

	return {
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
			rollupOptions: input ? { input } : undefined,
		},
	};
});
