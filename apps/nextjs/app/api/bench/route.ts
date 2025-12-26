function getIsolateId() {
  const globalAny = globalThis as any;
  if (!globalAny.__CF_BENCH_ISOLATE_ID) {
    globalAny.__CF_BENCH_ISOLATE_ID = crypto.randomUUID();
  }
  return globalAny.__CF_BENCH_ISOLATE_ID as string;
}
function json(data: unknown, init?: ResponseInit, timingStart?: number) {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  if (!headers.has("server-timing")) {
    const dur = typeof timingStart === "number" ? performance.now() - timingStart : null;
    headers.set(
      "server-timing",
      dur == null
        ? `cf_bench;desc=\"${getIsolateId()}\"`
        : `cf_bench;dur=${dur.toFixed(1)};desc=\"${getIsolateId()}\"`
    );
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function GET() {
  const start = performance.now();
  (globalThis as any).__CF_BENCH_ISOLATE_HITS = ((globalThis as any).__CF_BENCH_ISOLATE_HITS ?? 0) + 1;
  return json(
    { isolateId: getIsolateId(), hits: (globalThis as any).__CF_BENCH_ISOLATE_HITS, now: Date.now() },
    undefined,
    start
  );
}
