import { lazy } from "solid-js";
import { BenchHeaders } from "../lib/headers";

const Chart = lazy(async () => {
  const mod = await import("../../../solid/src/pages/Chart");
  return { default: mod.Chart };
});

export default function ChartPage() {
  return (
    <>
      <BenchHeaders routeId="/chart" />
      <Chart />
    </>
  );
}
