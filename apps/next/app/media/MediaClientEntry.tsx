"use client";

import type { MediaItem } from "@cf-bench/dataset";
import { MediaClient } from "./MediaClient";

export function MediaClientEntry({ items }: { items: MediaItem[] }) {
  return <MediaClient items={items} />;
}
