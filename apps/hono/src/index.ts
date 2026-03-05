import { Hono } from "hono";
import { handleBenchmarkRequest } from "@cf-bench/bench-contract";

type Bindings = CloudflareBindings & {
  ASSETS?: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

app.all("*", async (c) => {
  const bench = handleBenchmarkRequest("hono", c.req.raw);
  if (bench) return bench;

  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }

  return c.text("Not found", 404);
});

export default app;
