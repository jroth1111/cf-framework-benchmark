import { createApp } from "honox/server";
import { handleContractApi } from "@cf-bench/bench-contract";

type Env = { ASSETS?: Fetcher };

const CACHE_LIST = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const CACHE_DETAIL = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";

function benchmarkPageKind(pathname: string): "list" | "detail" | null {
	pathname = pathname.replace(/\/+$/, "") || "/";
	if (pathname === "/stays" || pathname === "/blog") return "list";
	if (/^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname)) return "detail";
	return null;
}

function benchmarkPageCache(profile: string | null, kind: "list" | "detail" | null): string {
	if (profile === "idiomatic" || profile === "mobile-cold") {
		if (kind === "detail") return CACHE_DETAIL;
		if (kind === "list") return CACHE_LIST;
	}
	return "no-store";
}

function getIsolateId(): string {
	const g = globalThis as typeof globalThis & { __CF_BENCH_ISOLATE_ID?: string };
	if (!g.__CF_BENCH_ISOLATE_ID) g.__CF_BENCH_ISOLATE_ID = crypto.randomUUID();
	return g.__CF_BENCH_ISOLATE_ID;
}

const honoxApp = createApp();

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const contract = handleContractApi("honox", request);
		if (contract) return contract;

		const start = performance.now();
		const response = await honoxApp.fetch(request, env, ctx);

		const contentType = response.headers.get("content-type") ?? "";
		if (!contentType.includes("text/html")) return response;

		const url = new URL(request.url);
		const kind = benchmarkPageKind(url.pathname);
		const profile = request.headers.get("x-cf-bench-profile");
		const headers = new Headers(response.headers);
		headers.set("cache-control", benchmarkPageCache(profile, kind));
		headers.set(
			"server-timing",
			`cf_bench;dur=${(performance.now() - start).toFixed(1)};desc="${getIsolateId()}"`
		);

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	},
};
