import app from "../dist/analog/server/index.mjs";

function cacheKind(pathname: string) {
  if (pathname === "/stays" || pathname === "/blog") return "list";
  if (/^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname)) return "detail";
  return null;
}

function cacheHeader(pathname: string) {
  const kind = cacheKind(pathname);
  if (kind === "detail") return "public, max-age=0, s-maxage=300, stale-while-revalidate=60";
  if (kind === "list") return "public, max-age=0, s-maxage=60, stale-while-revalidate=30";
  return "no-store";
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const start = performance.now();
    const response = await app.fetch(request, env, ctx);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return response;
    }

    const url = new URL(request.url);
    const headers = new Headers(response.headers);
    headers.set("cache-control", cacheHeader(url.pathname));
    if (!headers.has("server-timing")) {
      headers.set("server-timing", `cf_bench;dur=${(performance.now() - start).toFixed(1)}`);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
} satisfies ExportedHandler<Env>;
