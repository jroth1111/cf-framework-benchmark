import app from "../dist/server/entry-server.js";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const result = await app.fetch.call(app, request, env, ctx);
    if (result instanceof Response) {
      return result;
    }
    return new Response(result as BodyInit | null);
  },
} satisfies ExportedHandler<Env>;
