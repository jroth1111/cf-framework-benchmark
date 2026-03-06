'use client';

import { useEffect } from 'react';

export function HydrationMarker() {
  useEffect(() => {
    const w = window as typeof window & { __CF_BENCH__?: Record<string, any> };
    w.__CF_BENCH__ = w.__CF_BENCH__ || {};
    const hydration = (w.__CF_BENCH__.hydration = w.__CF_BENCH__.hydration || {});
    hydration.endMs = performance.now();
  }, []);

  return null;
}
