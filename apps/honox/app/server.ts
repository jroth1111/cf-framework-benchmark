import { createApp } from "honox/server";
import { handleContractApi } from "@cf-bench/bench-contract";
import { htmlCacheHeaderForPath } from "@cf-bench/bench-cache";

type Env = { ASSETS?: Fetcher };

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
		const url = new URL(request.url);
		const normalizedPathname = url.pathname.replace(/\/+$/, "") || "/";
		const routeRequest =
			normalizedPathname === url.pathname
				? request
				: new Request(new URL(`${normalizedPathname}${url.search}`, url).toString(), {
						method: request.method,
						headers: request.headers,
						body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
						redirect: request.redirect,
						signal: request.signal,
					});
		const response = await honoxApp.fetch(routeRequest, env, ctx);

		const contentType = response.headers.get("content-type") ?? "";
		if (!contentType.includes("text/html")) return response;

		const profile = request.headers.get("x-cf-bench-profile");
		const headers = new Headers(response.headers);
		headers.set("cache-control", htmlCacheHeaderForPath(normalizedPathname, profile));
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
