import { createSSRApp } from "vue";
import type { RouterHistory } from "vue-router";
import RootApp from "./RootApp";
import { createBenchRouter } from "./router";

export function createBenchApp(history: RouterHistory) {
	const app = createSSRApp(RootApp);
	const router = createBenchRouter(history);
	app.use(router);
	return { app, router };
}
