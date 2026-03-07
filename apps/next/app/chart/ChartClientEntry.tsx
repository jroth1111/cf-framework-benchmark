"use client";

import dynamic from "next/dynamic";

const ChartClient = dynamic(
  () => import("./ChartClient").then((module) => module.ChartClient),
  {
    ssr: false,
    loading: () => <p className="muted">Loading chart…</p>,
  }
);

export function ChartClientEntry() {
  return <ChartClient />;
}
