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

    const headers = new Headers(response.headers);
    if (!headers.has("server-timing")) {
      headers.set("server-timing", `cf_bench;dur=${(performance.now() - start).toFixed(1)}`);
    }
    if (!headers.has("cache-control")) {
      headers.set("cache-control", "no-store");
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
} satisfies ExportedHandler<Env>;
