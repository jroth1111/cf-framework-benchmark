import { $, component$, useSignal, useVisibleTask$ } from "@qwik.dev/core";
import type { MediaItem } from "@cf-bench/dataset";

type MediaResponse = {
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  results: MediaItem[];
};

export default component$(() => {
  const items = useSignal<MediaItem[]>([]);
  const selectedIndex = useSignal(0);
  const status = useSignal<"loading" | "ready" | "error">("loading");

  const ensureBenchMedia = () => {
    const w = window as any;
    w.__CF_BENCH__ = w.__CF_BENCH__ || {};
    w.__CF_BENCH__.media = w.__CF_BENCH__.media || { ready: false };
    return w.__CF_BENCH__.media;
  };

  useVisibleTask$(async () => {
    status.value = "loading";
    try {
      const res = await fetch("/api/media?pageSize=30");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as MediaResponse;
      items.value = payload.results || [];
      selectedIndex.value = 0;
      status.value = "ready";
      const media = ensureBenchMedia();
      media.ready = true;
      media.currentId = items.value[0]?.id || null;
    } catch (err) {
      status.value = "error";
      const media = ensureBenchMedia();
      media.ready = true;
      media.error = true;
      media.errorMessage = err instanceof Error ? err.message : String(err);
    }
  });

  const openByIndex$ = $((idx: number) => {
    const start = performance.now();
    selectedIndex.value = idx;
    const media = ensureBenchMedia();
    media.openDurationMs = performance.now() - start;
    media.ready = true;
    media.currentId = items.value[idx]?.id || null;
  });

  const nextItem$ = $(() => {
    if (!items.value.length) return;
    const start = performance.now();
    selectedIndex.value = (selectedIndex.value + 1) % items.value.length;
    const media = ensureBenchMedia();
    media.nextDurationMs = performance.now() - start;
    media.ready = true;
    media.currentId = items.value[selectedIndex.value]?.id || null;
  });

  const selected = items.value[selectedIndex.value];

  return (
    <>
      <h1 class="h1">Media Feed (SPA-like)</h1>

      <div class="grid cols-2" style="gap:16px">
        <div class="card" style="padding:14px">
          <h2 style="margin-top:0">Feed</h2>
          {status.value === "loading" && <p class="muted">Loading media…</p>}
          {status.value === "error" && <p class="muted">Failed to load media.</p>}

          <div style="display:grid;gap:10px;max-height:560px;overflow:auto">
            {items.value.map((item, idx) => (
              <button
                key={item.id}
                data-testid="media-card"
                class="card"
                style={`padding:10px;text-align:left;background:var(--panel);cursor:pointer;border:${idx === selectedIndex.value ? "1px solid var(--text)" : "1px solid var(--border)"}`}
                onClick$={() => openByIndex$(idx)}
              >
                <div style="font-weight:600">{item.title}</div>
                <div class="muted small">{item.channel} • {item.publishedISO}</div>
              </button>
            ))}
          </div>
        </div>

        <div class="card" style="padding:14px">
          <h2 style="margin-top:0">Player</h2>
          <div data-testid="media-player" style="min-height:260px">
            {selected ? (
              <>
                <img
                  src={selected.thumbnail}
                  alt={selected.title}
                  style="width:100%;max-height:280px;object-fit:cover;border-radius:10px"
                />
                <h3>{selected.title}</h3>
                <p class="muted small">{selected.channel} • {selected.views.toLocaleString()} views</p>
                <p class="muted">{selected.description}</p>
              </>
            ) : (
              <p class="muted">Select a media item.</p>
            )}
          </div>
          <button data-testid="media-next" class="btn" disabled={!items.value.length} onClick$={nextItem$}>Next</button>
        </div>
      </div>
    </>
  );
});
