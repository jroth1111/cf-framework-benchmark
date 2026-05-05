import { handleContractApi } from "@cf-bench/bench-contract";
import { defineApp } from "rwsdk/worker";
import { render } from "rwsdk/router";

import { Document } from "./app/document";
import { setCommonHeaders } from "./app/headers";
import { routes } from "./app/routes";

export type AppContext = Record<string, never>;

function normalizeBenchPath(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

function cacheKind(pathname: string) {
  pathname = normalizeBenchPath(pathname);
  if (pathname === "/stays" || pathname === "/blog") return "list";
  if (/^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname)) return "detail";
  return null;
}

function cacheHeader(pathname: string, profile: string | null) {
  const kind = cacheKind(pathname);
  if (profile === "idiomatic" || profile === "mobile-cold") {
    if (kind === "detail") return "public, max-age=0, s-maxage=300, stale-while-revalidate=600";
    if (kind === "list") return "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
  }
  return "no-store";
}

function applyHtmlHeaders(response: Response, pathname: string, profile: string | null, start: number) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const headers = new Headers(response.headers);
  headers.set("cache-control", cacheHeader(pathname, profile));
  if (!headers.has("server-timing")) {
    headers.set("server-timing", `cf_bench;dur=${(performance.now() - start).toFixed(1)}`);
  }
  return new Response(response.body, { ...response, headers });
}

const app = defineApp([setCommonHeaders(), ...render(Document, routes)]);

export default {
  ...app,
  async fetch(request: Request, env: Env, cf: ExecutionContext): Promise<Response> {
    const api = handleContractApi("redwood", request);
    if (api) return api;

    const start = performance.now();
    const response = await app.fetch(request, env, cf);
    return applyHtmlHeaders(
      response,
      new URL(request.url).pathname,
      request.headers.get("x-cf-bench-profile"),
      start,
    );
  },
};
