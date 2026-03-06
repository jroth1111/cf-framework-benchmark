import { handleContractApi } from "@cf-bench/bench-contract";
import { getListing, getPost } from "@cf-bench/dataset";
import { render } from "../src/entry-server";

type BenchEnv = Env & {
	ASSETS?: Fetcher;
};

function cacheKind(pathname: string) {
	if (pathname === "/stays" || pathname === "/blog") return "list";
	if (/^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname)) return "detail";
	return null;
}

function cacheHeader(pathname: string, profile: string | null) {
	const kind = cacheKind(pathname);
	if (profile === "idiomatic" || profile === "mobile-cold") {
		if (kind === "detail") return "public, max-age=0, s-maxage=300, stale-while-revalidate=600";
		if (kind === "list") return "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
	}
	return "no-store";
}

function isBenchRoute(pathname: string) {
	if (pathname === "/" || pathname === "/stays" || pathname === "/blog" || pathname === "/chart" || pathname === "/media") {
		return true;
	}
	if (/^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname)) return true;
	return false;
}

function assetRequestFor(url: URL, request: Request) {
	const headers = new Headers(request.headers);
	headers.delete("sec-fetch-mode");
	headers.delete("sec-fetch-dest");
	headers.delete("sec-fetch-site");
	headers.delete("sec-fetch-user");
	return new Request(url.toString(), {
		method: request.method,
		headers,
	});
}

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function pageTitle(pathname: string) {
	if (pathname === "/") return "Cloudflare Framework Benchmark";
	if (pathname === "/stays") return "Stays";
	if (pathname === "/blog") return "Blog";
	if (pathname === "/chart") return "Chart";
	if (pathname === "/media") return "Media";
	const stayMatch = pathname.match(/^\/stays\/([^/]+)$/);
	if (stayMatch) return getListing(stayMatch[1])?.title ?? "Listing not found";
	const blogMatch = pathname.match(/^\/blog\/([^/]+)$/);
	if (blogMatch) return getPost(blogMatch[1])?.title ?? "Post not found";
	return "Vue Benchmark";
}

function htmlHeaders(pathname: string, profile: string | null, start: number) {
	return new Headers({
		"content-type": "text/html; charset=utf-8",
		"cache-control": cacheHeader(pathname, profile),
		"server-timing": `cf_bench;dur=${(performance.now() - start).toFixed(1)}`,
	});
}

let shellPromise: Promise<string> | null = null;

async function getShell(env: BenchEnv, request: Request) {
	if (!env.ASSETS) return null;
	if (!shellPromise) {
		const shellUrl = new URL("/index.html", request.url);
		shellPromise = env.ASSETS.fetch(assetRequestFor(shellUrl, request)).then(async (response) => {
			if (!response.ok) {
				throw new Error(`Failed to load Vue shell: ${response.status}`);
			}
			return response.text();
		});
	}
	return shellPromise;
}

async function renderDocument(request: Request, env: BenchEnv) {
	const shell = await getShell(env, request);
	if (!shell) return new Response("Not found", { status: 404 });

	const url = new URL(request.url);
	const start = performance.now();
	const appHtml = await render(url.pathname);
	const route = escapeHtml(url.pathname);
	const documentHtml = shell
		.replaceAll("__CF_BENCH_ROUTE__", route)
		.replace("__CF_BENCH_TITLE__", escapeHtml(pageTitle(url.pathname)))
		.replace("__CF_BENCH_APP_HTML__", appHtml);

	return new Response(documentHtml, {
		status: 200,
		headers: htmlHeaders(url.pathname, request.headers.get("x-cf-bench-profile"), start),
	});
}

export default {
	async fetch(request, env: BenchEnv) {
		const api = handleContractApi("vue", request);
		if (api) return api;

		const url = new URL(request.url);
		if (isBenchRoute(url.pathname)) {
			return renderDocument(request, env);
		}

		if (!env.ASSETS) return new Response("Not found", { status: 404 });
		return env.ASSETS.fetch(assetRequestFor(url, request));
	},
} satisfies ExportedHandler<Env>;
