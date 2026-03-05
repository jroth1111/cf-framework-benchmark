import { useEffect, useMemo, useState } from "react";
import type { MediaItem } from "@cf-bench/dataset";

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
  const [items, setItems] = useState<MediaItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setStatus("loading");
      try {
        const res = await fetch("/api/media?pageSize=30");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as MediaResponse;
        if (cancelled) return;
        setItems(data.results || []);
        setSelectedIndex(0);
        setStatus("ready");

        const media = ensureBenchMedia();
        media.ready = true;
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        const media = ensureBenchMedia();
        media.ready = true;
        media.error = true;
        media.errorMessage = err instanceof Error ? err.message : String(err);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(() => items[selectedIndex] ?? null, [items, selectedIndex]);

  const openByIndex = (index: number) => {
    const start = performance.now();
    setSelectedIndex(index);
    requestAnimationFrame(() => {
      const media = ensureBenchMedia();
      media.openDurationMs = performance.now() - start;
      media.ready = true;
      media.currentId = items[index]?.id || null;
    });
  };

  const nextItem = () => {
    if (!items.length) return;
    const start = performance.now();
    const next = (selectedIndex + 1) % items.length;
    setSelectedIndex(next);
    requestAnimationFrame(() => {
      const media = ensureBenchMedia();
      media.nextDurationMs = performance.now() - start;
      media.ready = true;
      media.currentId = items[next]?.id || null;
    });
  };

  return (
    <>
      <h1 className="h1">Media Feed (SPA-like)</h1>

      <div className="grid cols-2" style={{ gap: 16 }}>
        <div className="card" style={{ padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>Feed</h2>
          {status === "loading" && <p className="muted">Loading media…</p>}
          {status === "error" && <p className="muted">Failed to load media.</p>}
          <div style={{ display: "grid", gap: 10, maxHeight: 560, overflow: "auto" }}>
            {items.map((item, idx) => (
              <button
                key={item.id}
                data-testid="media-card"
                className="card"
                style={{
                  padding: 10,
                  textAlign: "left",
                  border: idx === selectedIndex ? "1px solid var(--text)" : undefined,
                  background: "var(--panel)",
                  cursor: "pointer",
                }}
                onClick={() => openByIndex(idx)}
              >
                <div style={{ fontWeight: 600 }}>{item.title}</div>
                <div className="muted small">{item.channel} • {item.publishedISO}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <h2 style={{ marginTop: 0 }}>Player</h2>
          <div data-testid="media-player" style={{ minHeight: 260 }}>
            {selected ? (
              <>
                <img
                  src={selected.thumbnail}
                  alt={selected.title}
                  style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 10 }}
                />
                <h3>{selected.title}</h3>
                <p className="muted small">{selected.channel} • {selected.views.toLocaleString()} views</p>
                <p className="muted">{selected.description}</p>
              </>
            ) : (
              <p className="muted">Select a media item.</p>
            )}
          </div>
          <button data-testid="media-next" className="btn" onClick={nextItem} disabled={!items.length}>
            Next
          </button>
        </div>
      </div>
    </>
  );
}
