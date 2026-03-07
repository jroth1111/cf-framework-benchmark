import { createRouter, type RouteRecordRaw, type RouterHistory } from "vue-router";

const HomePage = () => import("../views/HomePage");
const StaysPage = () => import("../views/StaysPage");
const StayDetailPage = () => import("../views/StayDetailPage");
const BlogPage = () => import("../views/BlogPage");
const BlogPostPage = () => import("../views/BlogPostPage");
const ChartPage = () => import("../views/ChartPage");
const MediaPage = () => import("../views/MediaPage");

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
