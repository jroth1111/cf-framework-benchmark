import { Hono } from "hono/tiny";
import { handleContractApi } from "@cf-bench/bench-contract";
import { htmlCacheHeader } from "@cf-bench/bench-cache";
import { getListing, queryListings } from "@cf-bench/dataset";
import { getHifiStayDetailParts, renderHifiStaysListBody } from "@cf-bench/hifi-shell";
import { handleHonoPageRequest, renderHifiShell } from "./render";

type Bindings = CloudflareBindings & {
  ASSETS?: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

function serverTiming(start: number) {
  return `cf_bench;dur=${(performance.now() - start).toFixed(1)}`;
}

app.get("/hifi/stays", (c) => {
  const start = performance.now();
  const listings = queryListings({ page: 1, pageSize: 12 }).results;
  const html = renderHifiShell("Stays (hifi)", renderHifiStaysListBody(listings));
  c.header("content-type", "text/html; charset=utf-8");
  c.header("cache-control", htmlCacheHeader("/hifi/stays", c.req.header("x-cf-bench-profile") ?? null));
  c.header("server-timing", serverTiming(start));
  return c.body(html);
});

app.get("/hifi/stays/:id", (c) => {
  const start = performance.now();
  const id = c.req.param("id") ?? "";
  const listing = getListing(id);
  const parts = getHifiStayDetailParts(listing);
  const inlineScript = listing ? `<script>${parts.script}</script>` : "";
  const html = renderHifiShell(
    listing ? listing.title : "Stay not found",
    `${parts.body}${inlineScript}`
  );
  c.header("content-type", "text/html; charset=utf-8");
  c.header("cache-control", htmlCacheHeader("/hifi/stays/:id", c.req.header("x-cf-bench-profile") ?? null));
  c.header("server-timing", serverTiming(start));
  return c.body(html, listing ? 200 : 404);
});

app.all("*", async (c) => {
  const contract = handleContractApi("hono", c.req.raw);
  if (contract) return contract;

  const page = handleHonoPageRequest(c.req.raw);
  if (page) return page;

  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }

  return c.text("Not found", 404);
});

export default app;
