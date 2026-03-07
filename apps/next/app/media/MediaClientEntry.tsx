"use client";

import dynamic from "next/dynamic";
import type { MediaItem } from "@cf-bench/dataset";

const MediaClient = dynamic(
  () => import("./MediaClient").then((module) => module.MediaClient),
  {
    ssr: false,
    loading: () => <p className="muted">Loading media…</p>,
  }
);

export function MediaClientEntry({ items }: { items: MediaItem[] }) {
  return <MediaClient items={items} />;
}
