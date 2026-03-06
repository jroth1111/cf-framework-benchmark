import { Hono } from "hono";
import { handleBenchmarkRequest } from "@cf-bench/bench-contract";

type Bindings = CloudflareBindings & {
  ASSETS?: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();
const CACHE_LIST = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const CACHE_DETAIL = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";

function benchmarkPageKind(pathname: string) {
  if (pathname === "/stays" || pathname === "/blog") return "list";
  if (/^\/stays\/[^/]+$/.test(pathname) || /^\/blog\/[^/]+$/.test(pathname)) return "detail";
  return null;
}

function benchmarkPageCache(profile: string | null, kind: "list" | "detail" | null) {
  if (profile === "idiomatic" || profile === "mobile-cold") {
    return kind === "detail" ? CACHE_DETAIL : kind === "list" ? CACHE_LIST : "no-store";
  }
  return "no-store";
}

app.all("*", async (c) => {
  const bench = handleBenchmarkRequest("hono", c.req.raw);
  if (bench) {
    const contentType = bench.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return bench;

    const url = new URL(c.req.raw.url);
    const headers = new Headers(bench.headers);
    headers.set(
      "cache-control",
      benchmarkPageCache(c.req.header("x-cf-bench-profile") ?? null, benchmarkPageKind(url.pathname))
    );
    return new Response(bench.body, {
      status: bench.status,
      statusText: bench.statusText,
      headers,
    });
  }

  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }

  return c.text("Not found", 404);
});

export default app;
