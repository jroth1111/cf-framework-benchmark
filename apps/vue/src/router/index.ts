import { createRouter, type RouteRecordRaw, type RouterHistory } from "vue-router";
import HomePage from "@/views/HomePage";
import StaysPage from "@/views/StaysPage";
import StayDetailPage from "@/views/StayDetailPage";
import BlogPage from "@/views/BlogPage";
import BlogPostPage from "@/views/BlogPostPage";
import ChartPage from "@/views/ChartPage";
import MediaPage from "@/views/MediaPage";

const routes: RouteRecordRaw[] = [
	{ path: "/", name: "home", component: HomePage },
	{ path: "/stays", name: "stays", component: StaysPage },
	{ path: "/stays/:id", name: "stay-detail", component: StayDetailPage },
	{ path: "/blog", name: "blog", component: BlogPage },
	{ path: "/blog/:slug", name: "blog-post", component: BlogPostPage },
	{ path: "/chart", name: "chart", component: ChartPage },
	{ path: "/media", name: "media", component: MediaPage },
];

export function createBenchRouter(history: RouterHistory) {
	return createRouter({
		history,
		routes,
		scrollBehavior() {
			return { top: 0 };
		},
	});
}
