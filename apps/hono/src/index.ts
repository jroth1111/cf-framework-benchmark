import { Hono } from "hono/tiny";
import { handleContractApi } from "@cf-bench/bench-contract";
import { getListing, queryListings } from "@cf-bench/dataset";
import { getHifiStayDetailParts, renderHifiStaysListBody } from "@cf-bench/hifi-shell";
import { handleHonoPageRequest, renderHifiShell } from "./render";

type Bindings = CloudflareBindings & {
  ASSETS?: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();
const CACHE_LIST = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
const CACHE_DETAIL = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";
const CACHE_HIFI_DETAIL = "public, max-age=0, s-maxage=300, stale-while-revalidate=86400";

function normalizeBenchPath(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

function benchmarkPageKind(pathname: string) {
  pathname = normalizeBenchPath(pathname);
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

app.get("/hifi/stays", (c) => {
  const listings = queryListings({ page: 1, pageSize: 12 }).results;
  const html = renderHifiShell("Stays (hifi)", renderHifiStaysListBody(listings));
  c.header("content-type", "text/html; charset=utf-8");
  c.header("cache-control", CACHE_LIST);
  return c.body(html);
});

app.get("/hifi/stays/:id", (c) => {
  const id = c.req.param("id") ?? "";
  const listing = getListing(id);
  const parts = getHifiStayDetailParts(listing);
  const inlineScript = listing ? `<script>${parts.script}</script>` : "";
  const html = renderHifiShell(
    listing ? listing.title : "Stay not found",
    `${parts.body}${inlineScript}`
  );
  c.header("content-type", "text/html; charset=utf-8");
  c.header("cache-control", CACHE_HIFI_DETAIL);
  return c.body(html, listing ? 200 : 404);
});

app.all("*", async (c) => {
  const contract = handleContractApi("hono", c.req.raw);
  if (contract) return contract;

  const page = handleHonoPageRequest(c.req.raw);
  if (page) {
    const contentType = page.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return page;

    const url = new URL(c.req.raw.url);
    const headers = new Headers(page.headers);
    headers.set(
      "cache-control",
      benchmarkPageCache(c.req.header("x-cf-bench-profile") ?? null, benchmarkPageKind(url.pathname))
    );
    return new Response(page.body, {
      status: page.status,
      statusText: page.statusText,
      headers,
    });
  }

  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }

  return c.text("Not found", 404);
});

export default app;
