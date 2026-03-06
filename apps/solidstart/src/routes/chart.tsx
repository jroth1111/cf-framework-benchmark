import { lazy } from "solid-js";

const Chart = lazy(async () => {
  const mod = await import("../../../solid/src/pages/Chart");
  return { default: mod.Chart };
});

export default function ChartPage() {
  return <Chart />;
}
