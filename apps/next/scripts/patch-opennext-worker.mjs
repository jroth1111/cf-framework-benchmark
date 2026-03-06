import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const workerPath = path.join(appDir, ".open-next/worker.js");
let source = await fs.readFile(workerPath, "utf8");

if (!source.includes("applyBenchHtmlHeaders")) {
  source = source.replace(
    'export { BucketCachePurge } from "./.build/durable-objects/bucket-cache-purge.js";\n',
    `export { BucketCachePurge } from "./.build/durable-objects/bucket-cache-purge.js";
const BENCH_PROFILE_HEADER = "x-cf-bench-profile";
const CACHE_LIST = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const CACHE_DETAIL = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";
function cacheKind(pathname) {
    if (pathname === "/stays" || pathname === "/blog")
        return "list";
    if (/^\\/stays\\/[^/]+$/.test(pathname) || /^\\/blog\\/[^/]+$/.test(pathname))
        return "detail";
    return null;
}
function cacheHeader(profile, kind) {
    if (profile === "idiomatic" || profile === "mobile-cold") {
        if (kind === "detail")
            return CACHE_DETAIL;
        if (kind === "list")
            return CACHE_LIST;
    }
    return "no-store";
}
function applyBenchHtmlHeaders(response, request, start) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html"))
        return response;
    const headers = new Headers(response.headers);
    const pathname = new URL(request.url).pathname;
    const duration = Math.max(0.1, performance.now() - start);
    headers.set("cache-control", cacheHeader(request.headers.get(BENCH_PROFILE_HEADER), cacheKind(pathname)));
    headers.set("server-timing", \`cf_bench;dur=\${duration.toFixed(1)}\`);
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}
`
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
