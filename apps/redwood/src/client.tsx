"use client";

import { initClient, initClientNavigation } from "rwsdk/client";

declare global {
  interface Window {
    __CF_BENCH__?: {
      hydration?: {
        endMs?: number;
      };
    };
  }
}

const { handleResponse, onHydrated } = initClientNavigation();

initClient({
  handleResponse,
  onHydrated() {
    onHydrated();
    const bench = (window.__CF_BENCH__ = window.__CF_BENCH__ || {});
    const hydration = (bench.hydration = bench.hydration || {});
    hydration.endMs = performance.now();
  },
});
