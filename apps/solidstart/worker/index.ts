import { htmlCacheHeaderForPath } from "@cf-bench/bench-cache";
import app from "../dist/server/entry-server.js";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const start = performance.now();
    const result = await app.fetch.call(app, request, env, ctx);
    const response =
      result instanceof Response
        ? result
        : new Response(result as BodyInit | null);

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return response;
    }

    const { pathname } = new URL(request.url);
    const profile = request.headers.get("x-cf-bench-profile");
    const headers = new Headers(response.headers);
    headers.set("cache-control", htmlCacheHeaderForPath(pathname, profile));
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
