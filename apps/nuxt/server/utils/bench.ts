import type { H3Event } from "h3";

export function eventToRequest(event: H3Event) {
  const method = event.node.req.method || "GET";
  const proto = event.node.req.headers["x-forwarded-proto"] || "https";
  const host = event.node.req.headers.host || "cf-bench.local";
  const path = event.node.req.url || "/";
  return new Request(`${proto}://${host}${path}`, { method });
}
