import "./assets/main.css";
import { createWebHistory } from "vue-router";
import { createBenchApp } from "./app";

const { app, router } = createBenchApp(createWebHistory(import.meta.env.BASE_URL));

router.isReady().then(() => {
	app.mount("#app");
	requestAnimationFrame(() => {
		const w = window as typeof window & { __CF_BENCH__?: Record<string, any> };
		w.__CF_BENCH__ = w.__CF_BENCH__ || {};
		const hydration = (w.__CF_BENCH__.hydration = w.__CF_BENCH__.hydration || {});
		hydration.endMs = performance.now();
	});
});
