import { getResponseHeader, setResponseHeader } from "h3";

type BenchEvent = {
  context: {
    cfBenchStart?: number;
  };
};

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("request", (event) => {
    (event as BenchEvent).context.cfBenchStart = performance.now();
  });

  nitroApp.hooks.hook("beforeResponse", (event) => {
    const contentType = getResponseHeader(event, "content-type") || "";
    if (!contentType.includes("text/html")) return;

    const start = (event as BenchEvent).context.cfBenchStart;
    if (typeof start !== "number") return;
    setResponseHeader(event, "server-timing", `cf_bench;dur=${(performance.now() - start).toFixed(1)}`);
  });
});
