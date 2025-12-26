import { useEffect } from "react";

function ensureHydrationStart() {
  if (typeof window === "undefined") return;
  const w = window as any;
  w.__CF_BENCH__ = w.__CF_BENCH__ || {};
  const hydration = (w.__CF_BENCH__.hydration = w.__CF_BENCH__.hydration || {});
  if (hydration.startMs == null) hydration.startMs = performance.now();
}

export function HydrationMarker() {
  ensureHydrationStart();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as any;
    w.__CF_BENCH__ = w.__CF_BENCH__ || {};
    const hydration = (w.__CF_BENCH__.hydration = w.__CF_BENCH__.hydration || {});
    hydration.endMs = performance.now();
  }, []);

  return null;
}
