import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";
import vue from "@vitejs/plugin-vue";
import { blogPosts, queryListings } from "../../../packages/dataset/src/index.js";

const root = process.cwd();
const pagesDir = path.join(root, "pages");

function rmrf(target) {
	if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

function mkdirp(target) {
	fs.mkdirSync(target, { recursive: true });
}

function writeFile(target, content) {
	mkdirp(path.dirname(target));
	fs.writeFileSync(target, content, "utf8");
}

function pageTitle(route) {
	if (route === "/") return "CF Bench Vue";
	if (route.startsWith("/stays/")) return "CF Bench Vue Stays";
	if (route.startsWith("/blog/")) return "CF Bench Vue Blog";
	if (route === "/stays") return "CF Bench Vue Stays";
	if (route === "/blog") return "CF Bench Vue Blog";
	if (route === "/chart") return "CF Bench Vue Chart";
	if (route === "/media") return "CF Bench Vue Media";
	return "CF Bench Vue";
}

function renderDocument(route, appHtml) {
	return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${pageTitle(route)}</title>
    <link rel="stylesheet" href="/src/assets/main.css" />
    <script>
      (function () {
        var w = window;
        w.__CF_BENCH__ = w.__CF_BENCH__ || {};
        var h = (w.__CF_BENCH__.hydration = w.__CF_BENCH__.hydration || {});
        if (h.startMs == null) h.startMs = performance.now();
      })();
    </script>
  </head>
  <body data-route="${route}">
    <div id="app">${appHtml}</div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`;
}

const stayRoutes = queryListings({ page: 1, pageSize: 12 }).results.map((listing) => `/stays/${listing.id}`);
const blogRoutes = blogPosts.map((post) => `/blog/${post.slug}`);
const staticRoutes = ["/", "/stays", "/chart", "/media", "/blog", ...stayRoutes, ...blogRoutes];

rmrf(pagesDir);
mkdirp(pagesDir);

const vite = await createServer({
	root,
	appType: "custom",
	logLevel: "error",
	server: { middlewareMode: true },
	plugins: [vue()],
	resolve: {
		alias: {
			"@": path.join(root, "src"),
			"@cf-bench/dataset": path.join(root, "../../packages/dataset/src/index.js"),
			"@cf-bench/chart-core": path.join(root, "../../packages/chart-core/src/index.js"),
			"@cf-bench/bench-types": path.join(root, "../../packages/bench-types/src/index.ts"),
			"@cf-bench/ui/styles.css": path.join(root, "../../packages/ui/src/styles.css"),
		},
	},
});

try {
	const { render } = await vite.ssrLoadModule("/src/entry-server.ts");
	for (const route of staticRoutes) {
		const appHtml = await render(route);
		const file = route === "/" ? path.join(pagesDir, "index.html") : path.join(pagesDir, route, "index.html");
		writeFile(file, renderDocument(route, appHtml));
	}
} finally {
	await vite.close();
}

console.log(`Generated Vue benchmark pages in ${pagesDir}`);
