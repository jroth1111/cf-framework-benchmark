import { Hono } from "hono/tiny";
import { handleContractApi } from "@cf-bench/bench-contract";
import { handleHonoPageRequest } from "./render";

type Bindings = CloudflareBindings & {
  ASSETS?: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

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
