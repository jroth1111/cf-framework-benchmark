import { handleContractApi } from "@cf-bench/bench-contract";
import { getListing, getPost } from "@cf-bench/dataset";
import { render } from "../src/entry-server";

type BenchEnv = Env & {
	ASSETS?: Fetcher;
};

function normalizeBenchPath(pathname: string) {
	return pathname.replace(/\/+$/, "") || "/";
}

function cacheKind(pathname: string) {
	const normalizedPath = normalizeBenchPath(pathname);
	if (normalizedPath === "/stays" || normalizedPath === "/blog") return "list";
	if (/^\/stays\/[^/]+$/.test(normalizedPath) || /^\/blog\/[^/]+$/.test(normalizedPath)) return "detail";
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
	const normalizedPath = normalizeBenchPath(pathname);
	if (
		normalizedPath === "/" ||
		normalizedPath === "/stays" ||
		normalizedPath === "/blog" ||
		normalizedPath === "/chart" ||
		normalizedPath === "/media"
	) {
		return true;
	}
	if (/^\/stays\/[^/]+$/.test(normalizedPath) || /^\/blog\/[^/]+$/.test(normalizedPath)) return true;
	return false;
}

function needsClient(pathname: string) {
	const normalizedPath = normalizeBenchPath(pathname);
	return normalizedPath === "/chart" || normalizedPath === "/media";
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
	const normalizedPath = normalizeBenchPath(pathname);
	if (normalizedPath === "/") return "Cloudflare Framework Benchmark";
	if (normalizedPath === "/stays") return "Stays";
	if (normalizedPath === "/blog") return "Blog";
	if (normalizedPath === "/chart") return "Chart";
	if (normalizedPath === "/media") return "Media";
	const stayMatch = normalizedPath.match(/^\/stays\/([^/]+)$/);
	if (stayMatch) return getListing(stayMatch[1])?.title ?? "Listing not found";
	const blogMatch = normalizedPath.match(/^\/blog\/([^/]+)$/);
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
	const pathname = normalizeBenchPath(url.pathname);
	const start = performance.now();
	const appHtml = await render(pathname);
	const route = escapeHtml(pathname);
	const includeClient = needsClient(pathname);
	const hydrationTail = includeClient
		? ""
		: '<script>(function(){var w=globalThis;w.__CF_BENCH__=w.__CF_BENCH__||{};var h=(w.__CF_BENCH__.hydration=w.__CF_BENCH__.hydration||{});if(h.endMs==null)h.endMs=h.startMs??performance.now();})();</script>';
	const documentHtml = shell
		.replaceAll("__CF_BENCH_ROUTE__", route)
		.replace("__CF_BENCH_TITLE__", escapeHtml(pageTitle(pathname)))
		.replace("__CF_BENCH_APP_HTML__", `${appHtml}${hydrationTail}`)
		.replace(
			/__CF_BENCH_CLIENT_ASSETS_START__[\s\S]*?__CF_BENCH_CLIENT_ASSETS_END__/,
			includeClient ? "__CF_BENCH_CLIENT_ASSETS_START__" : "",
		)
		.replace(includeClient ? /$^/ : /<script type="module" crossorigin src="\/assets\/index-[^"]+\.js"><\/script>\s*/g, "")
		.replace("__CF_BENCH_CLIENT_ASSETS_START__", "")
		.replace("__CF_BENCH_CLIENT_ASSETS_END__", "");

	return new Response(documentHtml, {
		status: 200,
		headers: htmlHeaders(pathname, request.headers.get("x-cf-bench-profile"), start),
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
