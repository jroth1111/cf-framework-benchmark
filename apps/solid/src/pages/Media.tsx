import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import type { MediaItem } from "@cf-bench/dataset";
import { Layout } from "../components/Layout";

type MediaResponse = {
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  results: MediaItem[];
};

function ensureBenchMedia() {
  const w = window as any;
  w.__CF_BENCH__ = w.__CF_BENCH__ || {};
  w.__CF_BENCH__.media = w.__CF_BENCH__.media || { ready: false };
  return w.__CF_BENCH__.media;
}

export function Media() {
  const [items, setItems] = createSignal<MediaItem[]>([]);
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [status, setStatus] = createSignal<"loading" | "ready" | "error">("loading");

  onMount(async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/media?pageSize=30");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as MediaResponse;
      setItems(payload.results || []);
      setSelectedIndex(0);
      setStatus("ready");
      const media = ensureBenchMedia();
      media.ready = true;
      media.currentId = payload.results?.[0]?.id || null;
    } catch (err) {
      setStatus("error");
      const media = ensureBenchMedia();
      media.ready = true;
      media.error = true;
      media.errorMessage = err instanceof Error ? err.message : String(err);
    }
  });

  const selected = createMemo(() => items()[selectedIndex()] ?? null);

  const openByIndex = (idx: number) => {
    const start = performance.now();
    setSelectedIndex(idx);
    requestAnimationFrame(() => {
      const media = ensureBenchMedia();
      media.openDurationMs = performance.now() - start;
      media.ready = true;
      media.currentId = items()[idx]?.id || null;
    });
  };

  const nextItem = () => {
    if (!items().length) return;
    const start = performance.now();
    const next = (selectedIndex() + 1) % items().length;
    setSelectedIndex(next);
    requestAnimationFrame(() => {
      const media = ensureBenchMedia();
      media.nextDurationMs = performance.now() - start;
      media.ready = true;
      media.currentId = items()[next]?.id || null;
    });
  };

  return (
    <Layout title="Media Feed (SPA-like)">
      <div class="grid cols-2" style="gap:16px">
        <div class="card" style="padding:14px">
          <h2 style="margin-top:0">Feed</h2>
          <Show when={status() === "loading"}><p class="muted">Loading media…</p></Show>
          <Show when={status() === "error"}><p class="muted">Failed to load media.</p></Show>

          <div style="display:grid;gap:10px;max-height:560px;overflow:auto">
            <For each={items()}>
              {(item, idx) => (
                <button
                  data-testid="media-card"
                  class="card"
                  style={`padding:10px;text-align:left;background:var(--panel);cursor:pointer;border:${idx() === selectedIndex() ? "1px solid var(--text)" : "1px solid var(--border)"}`}
                  onClick={() => openByIndex(idx())}
                >
                  <div style="font-weight:600">{item.title}</div>
                  <div class="muted small">{item.channel} • {item.publishedISO}</div>
                </button>
              )}
            </For>
          </div>
        </div>

        <div class="card" style="padding:14px">
          <h2 style="margin-top:0">Player</h2>
          <div data-testid="media-player" style="min-height:260px">
            <Show when={selected()} fallback={<p class="muted">Select a media item.</p>}>
              {(item) => (
                <>
                  <img
                    src={item().thumbnail}
                    alt={item().title}
                    style="width:100%;max-height:280px;object-fit:cover;border-radius:10px"
                  />
                  <h3>{item().title}</h3>
                  <p class="muted small">{item().channel} • {item().views.toLocaleString()} views</p>
                  <p class="muted">{item().description}</p>
                </>
              )}
            </Show>
          </div>
          <button data-testid="media-next" class="btn" onClick={nextItem} disabled={!items().length}>Next</button>
        </div>
      </div>
    </Layout>
  );
}
