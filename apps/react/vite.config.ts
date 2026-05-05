import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
    plugins: [react()],
    build: {
        outDir: "dist",
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes("@cf-bench/chart-core")) return "chart";
                    if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/react-router-dom")) return "vendor";
                    return undefined;
                },
            },
        },
    },
});
