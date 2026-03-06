import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "node:fs";
import path from "node:path";

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

export default defineConfig(() => {
    const pagesDir = path.resolve(__dirname, "pages");
    const input = fs.existsSync(pagesDir) ? collectHtmlInputs(pagesDir) : undefined;

    return {
        plugins: [react()],
        build: {
            outDir: "dist",
            rollupOptions: {
                ...(input ? { input } : {}),
                output: {
                    manualChunks: {
                        vendor: ["react", "react-dom", "react-router-dom"],
                        chart: ["@cf-bench/chart-core"],
                    },
                },
            },
        },
    };
});
