import { handleBenchmarkRequest } from "@cf-bench/bench-contract";

type BenchEnv = Env & {
	ASSETS?: Fetcher;
};

export default {
	async fetch(request, env: BenchEnv) {
		const bench = handleBenchmarkRequest("vue", request);
		if (bench) return bench;

		if (env.ASSETS) {
			return env.ASSETS.fetch(request);
		}

		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;
