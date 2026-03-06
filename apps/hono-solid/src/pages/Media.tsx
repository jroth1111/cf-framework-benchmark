import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import { queryMedia, type MediaItem } from "@cf-bench/dataset";
import { Layout } from "../components/Layout";

function ensureBenchMedia() {
  const w = window as any;
  w.__CF_BENCH__ = w.__CF_BENCH__ || {};
  w.__CF_BENCH__.media = w.__CF_BENCH__.media || { ready: false };
  return w.__CF_BENCH__.media;
}

export function Media(props: { initialItems?: MediaItem[] }) {
  const initialItems = props.initialItems ?? queryMedia({ pageSize: 30 }).results;
  const [items] = createSignal<MediaItem[]>(initialItems);
  const [selectedIndex, setSelectedIndex] = createSignal<number | null>(null);
  const [showPoster, setShowPoster] = createSignal(false);
  const [status] = createSignal<"ready" | "error">(initialItems.length ? "ready" : "error");

  onMount(() => {
    const media = ensureBenchMedia();
    media.ready = false;
    media.currentId = null;
  });

  const selected = createMemo(() => {
    const index = selectedIndex();
    return index == null ? null : items()[index] ?? null;
  });

  const openByIndex = (idx: number) => {
    const start = performance.now();
    setSelectedIndex(idx);
    setShowPoster(true);
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
    const next = ((selectedIndex() ?? -1) + 1) % items().length;
    setSelectedIndex(next);
    setShowPoster(true);
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
                  <Show when={showPoster()}>
                    <img
                      src={item().thumbnail}
                      alt={item().title}
                      loading="lazy"
                      decoding="async"
                      fetchpriority="low"
                      style="width:100%;max-height:280px;object-fit:cover;border-radius:10px"
                    />
                  </Show>
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
