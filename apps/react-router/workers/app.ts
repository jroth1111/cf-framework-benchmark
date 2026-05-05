import { createRequestHandler } from "react-router";
import { handleContractApi } from "@cf-bench/bench-contract";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

const BENCH_PROFILE_HEADER = "x-cf-bench-profile";
const CACHE_LIST = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const CACHE_DETAIL = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";

function normalizeBenchPath(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

function cacheKind(pathname: string) {
  pathname = normalizeBenchPath(pathname);
  if (pathname === "/stays" || pathname === "/blog") return "list";
  if (/^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname)) return "detail";
  return null;
}

function cacheHeader(profile: string | null, kind: "list" | "detail" | null) {
  if (profile === "idiomatic" || profile === "mobile-cold") {
    if (kind === "detail") return CACHE_DETAIL;
    if (kind === "list") return CACHE_LIST;
  }
  return "no-store";
}

export default {
  async fetch(request, env, ctx) {
    const api = handleContractApi("react-router", request);
    if (api) return api;

    const start = performance.now();
    const response = await requestHandler(request, {
      cloudflare: { env, ctx },
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return response;
    }

    const url = new URL(request.url);
    const headers = new Headers(response.headers);
    headers.set("cache-control", cacheHeader(request.headers.get(BENCH_PROFILE_HEADER), cacheKind(url.pathname)));
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
