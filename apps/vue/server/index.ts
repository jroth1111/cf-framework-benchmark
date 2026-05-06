import { handleContractApi } from "@cf-bench/bench-contract";
import { getListing, getPost } from "@cf-bench/dataset";
import { getHifiHeadHtml } from "@cf-bench/hifi-shell";
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

function isHifiStaysListPath(pathname: string) {
	return normalizeBenchPath(pathname) === "/hifi/stays";
}

function isHifiStayDetailPath(pathname: string) {
	return /^\/hifi\/stays\/[^/]+$/.test(normalizeBenchPath(pathname));
}

function cacheHeader(pathname: string, profile: string | null) {
	if (isHifiStaysListPath(pathname)) return "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
	if (isHifiStayDetailPath(pathname)) return "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";
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
	if (isHifiStaysListPath(normalizedPath) || isHifiStayDetailPath(normalizedPath)) return true;
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
	if (normalizedPath === "/hifi/stays") return "Stays (hifi)";
	const hifiStayMatch = normalizedPath.match(/^\/hifi\/stays\/([^/]+)$/);
	if (hifiStayMatch) return getListing(hifiStayMatch[1])?.title ?? "Stay not found";
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

function buildLinkHeader(head: string): string | null {
	const links: string[] = [];
	for (const m of head.matchAll(/<link ([^>]+)>/g)) {
		const attrs = m[1] ?? "";
		const rel = attrs.match(/\brel="([^"]+)"/)?.[1];
		const href = attrs.match(/\bhref="([^"]+)"/)?.[1];
		if (!rel || !href) continue;
		if (rel === "stylesheet") links.push(`<${href}>; rel=preload; as=style`);
		else if (rel === "modulepreload") links.push(`<${href}>; rel=modulepreload; as=script`);
	}
	return links.length ? links.join(", ") : null;
}

const APP_HTML_PLACEHOLDER = "__CF_BENCH_APP_HTML__";
const CLIENT_ASSETS_RE = /__CF_BENCH_CLIENT_ASSETS_START__[\s\S]*?__CF_BENCH_CLIENT_ASSETS_END__/;
const CLIENT_MODULE_SCRIPT_RE = /\s*<script type="module" crossorigin src="\/assets\/index-[^"]+\.js"><\/script>/g;
const CLIENT_MODULE_PRELOAD_RE = /\s*<link rel="modulepreload" crossorigin href="\/assets\/[^"]+">/g;
const HYDRATION_TAIL =
	'<script>(function(){var w=globalThis;w.__CF_BENCH__=w.__CF_BENCH__||{};var h=(w.__CF_BENCH__.hydration=w.__CF_BENCH__.hydration||{});if(h.endMs==null)h.endMs=h.startMs??performance.now();})();</script>';

type ShellParts = {
	head: string;
	tail: string;
};

let shellPromise: Promise<ShellParts> | null = null;

function isValidShell(shell: string) {
	return (
		shell.includes("__CF_BENCH_ROUTE__") &&
		shell.includes("__CF_BENCH_TITLE__") &&
		shell.includes(APP_HTML_PLACEHOLDER)
	);
}

function splitShell(shell: string): ShellParts {
	const splitIndex = shell.indexOf(APP_HTML_PLACEHOLDER);
	if (splitIndex < 0) {
		throw new Error("Failed to load Vue shell: missing app placeholder");
	}

	return {
		head: shell.slice(0, splitIndex),
		tail: shell.slice(splitIndex + APP_HTML_PLACEHOLDER.length),
	};
}

function resolveShellParts(shell: ShellParts, pathname: string, includeClient: boolean): ShellParts {
	const route = escapeHtml(pathname);
	const title = escapeHtml(pageTitle(pathname));
	let head = shell.head
		.replaceAll("__CF_BENCH_ROUTE__", route)
		.replaceAll("__CF_BENCH_TITLE__", title)
		.replace(CLIENT_ASSETS_RE, "")
		.replace(includeClient ? /$^/ : CLIENT_MODULE_SCRIPT_RE, "")
		.replace(includeClient ? /$^/ : CLIENT_MODULE_PRELOAD_RE, "");
	if (isHifiStaysListPath(pathname) || isHifiStayDetailPath(pathname)) {
		head = head.replace(/<\/head>/i, `${getHifiHeadHtml()}</head>`);
	}
	const tailWithoutMarkers = shell.tail
		.replaceAll("__CF_BENCH_ROUTE__", route)
		.replaceAll("__CF_BENCH_TITLE__", title)
		.replace(CLIENT_ASSETS_RE, "");

	return {
		head,
		tail: includeClient ? tailWithoutMarkers : `${HYDRATION_TAIL}${tailWithoutMarkers}`,
	};
}

function createDocumentStream(head: string, appStream: ReadableStream<Uint8Array>, tail: string) {
	const encoder = new TextEncoder();

	return new ReadableStream<Uint8Array>({
		async start(controller) {
			controller.enqueue(encoder.encode(head));
			const reader = appStream.getReader();
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					if (value) controller.enqueue(value);
				}
				controller.enqueue(encoder.encode(tail));
				controller.close();
			} catch (error) {
				controller.error(error);
			} finally {
				reader.releaseLock();
			}
		},
		cancel(reason) {
			return appStream.cancel(reason);
		},
	});
}

async function getShell(env: BenchEnv, request: Request) {
	if (!env.ASSETS) return null;
	if (!shellPromise) {
		const shellUrl = new URL("/index.html", request.url);
		shellPromise = env.ASSETS.fetch(assetRequestFor(shellUrl, request))
			.then(async (response) => {
				if (!response.ok) {
					throw new Error(`Failed to load Vue shell: ${response.status}`);
				}
				const shell = await response.text();
				if (!isValidShell(shell)) {
					throw new Error("Failed to load Vue shell: missing benchmark placeholders");
				}
				return splitShell(shell);
			})
			.catch((error) => {
				shellPromise = null;
				throw error;
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
	const includeClient = needsClient(pathname);
	const { head, tail } = resolveShellParts(shell, pathname, includeClient);
	const appStream = await render(pathname);
	const headers = htmlHeaders(pathname, request.headers.get("x-cf-bench-profile"), start);
	const link = buildLinkHeader(head);
	if (link) headers.set("link", link);

	return new Response(createDocumentStream(head, appStream, tail), {
		status: 200,
		headers,
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
