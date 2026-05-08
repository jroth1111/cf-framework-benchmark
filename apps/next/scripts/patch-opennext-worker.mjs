import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NO_STORE, htmlCacheHeaderTable } from "@cf-bench/bench-cache";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const workerPath = path.join(appDir, ".open-next/worker.js");
let source = await fs.readFile(workerPath, "utf8");

if (!source.includes("applyBenchHtmlHeaders")) {
  const cacheTable = htmlCacheHeaderTable();
  const cacheTableLiteral = JSON.stringify(cacheTable);
  const noStoreLiteral = JSON.stringify(NO_STORE);
  const injected = `export { BucketCachePurge } from "./.build/durable-objects/bucket-cache-purge.js";
const BENCH_PROFILE_HEADER = "x-cf-bench-profile";
const BENCH_HTML_CACHE_TABLE = ${cacheTableLiteral};
const BENCH_NO_STORE = ${noStoreLiteral};
const BENCH_PROFILES_PRESERVING_CACHE = new Set(["idiomatic", "mobile-cold"]);
function classifyBenchHtmlRoute(pathname) {
    const normalized = String(pathname || "").replace(/\\/+$/, "") || "/";
    if (BENCH_HTML_CACHE_TABLE[normalized] !== undefined) return normalized;
    if (/^\\/hifi\\/stays\\/[^/]+$/.test(normalized)) return "/hifi/stays/:id";
    if (/^\\/stays\\/[^/]+$/.test(normalized)) return "/stays/:id";
    if (/^\\/blog\\/[^/]+$/.test(normalized)) return "/blog/:slug";
    return null;
}
function benchCacheHeader(pathname, profile) {
    const routeId = classifyBenchHtmlRoute(pathname);
    if (routeId === null) return BENCH_NO_STORE;
    const expected = BENCH_HTML_CACHE_TABLE[routeId];
    if (typeof expected !== "string" || expected === BENCH_NO_STORE) return BENCH_NO_STORE;
    if (typeof routeId === "string" && routeId.startsWith("/hifi/")) return expected;
    if (BENCH_PROFILES_PRESERVING_CACHE.has(profile)) return expected;
    return BENCH_NO_STORE;
}
function applyBenchHtmlHeaders(response, request, start) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html"))
        return response;
    const headers = new Headers(response.headers);
    const pathname = new URL(request.url).pathname;
    const duration = Math.max(0.1, performance.now() - start);
    headers.set("cache-control", benchCacheHeader(pathname, request.headers.get(BENCH_PROFILE_HEADER)));
    headers.set("server-timing", \`cf_bench;dur=\${duration.toFixed(1)}\`);
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}
`;
  source = source.replace(
    'export { BucketCachePurge } from "./.build/durable-objects/bucket-cache-purge.js";\n',
    injected
  );
}

source = source.replace(
  "    async fetch(request, env, ctx) {\n        return runWithCloudflareRequestContext(request, env, ctx, async () => {",
  "    async fetch(request, env, ctx) {\n        const benchStart = performance.now();\n        return runWithCloudflareRequestContext(request, env, ctx, async () => {"
);

source = source.replace(
  "                return reqOrResp;\n",
  "                return applyBenchHtmlHeaders(reqOrResp, request, benchStart);\n"
);

source = source.replace(
  "            return handler(reqOrResp, env, ctx, request.signal);\n",
  "            const benchResponse = await handler(reqOrResp, env, ctx, request.signal);\n            return applyBenchHtmlHeaders(benchResponse, request, benchStart);\n"
);

await fs.writeFile(workerPath, source);
