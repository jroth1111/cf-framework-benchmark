import worker from "./.output/server/index.mjs";

function applyHtmlTiming(response, start) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const headers = new Headers(response.headers);
  headers.set("server-timing", `cf_bench;dur=${(performance.now() - start).toFixed(1)}`);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    const start = performance.now();
    const response = await worker.fetch(request, env, ctx);
    return applyHtmlTiming(response, start);
  },
};
