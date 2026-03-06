import { useMemo, useState } from "react";
import type { Route } from "./+types/media";
import { queryMedia } from "../lib/data";

function ensureBenchMedia() {
  const w = window as any;
  w.__CF_BENCH__ = w.__CF_BENCH__ || {};
  w.__CF_BENCH__.media = w.__CF_BENCH__.media || { ready: false };
  return w.__CF_BENCH__.media;
}

export function loader() {
  return queryMedia({ pageSize: 30 });
}

export default function MediaRoute({ loaderData }: Route.ComponentProps) {
  const [items] = useState(loaderData.results);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = useMemo(() => items[selectedIndex] ?? null, [items, selectedIndex]);

  const openByIndex = (index: number) => {
    const started = performance.now();
    setSelectedIndex(index);
    requestAnimationFrame(() => {
      const media = ensureBenchMedia();
      media.openDurationMs = performance.now() - started;
      media.ready = true;
      media.currentId = items[index]?.id || null;
    });
  };

  const nextItem = () => {
    if (!items.length) return;
    const started = performance.now();
    const next = (selectedIndex + 1) % items.length;
    setSelectedIndex(next);
    requestAnimationFrame(() => {
      const media = ensureBenchMedia();
      media.nextDurationMs = performance.now() - started;
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
          <div style={{ display: "grid", gap: 10, maxHeight: 560, overflow: "auto" }}>
            {items.map((item, index) => (
              <button
                key={item.id}
                data-testid="media-card"
                className="card"
                style={{
                  padding: 10,
                  textAlign: "left",
                  background: "var(--panel)",
                  cursor: "pointer",
                  border: index === selectedIndex ? "1px solid var(--text)" : "1px solid var(--border)",
                }}
                onClick={() => openByIndex(index)}
              >
                <div style={{ fontWeight: 600 }}>{item.title}</div>
                <div className="muted small">
                  {item.channel} • {item.publishedISO}
                </div>
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
                <p className="muted small">
                  {selected.channel} • {selected.views.toLocaleString()} views
                </p>
                <p className="muted">{selected.description}</p>
              </>
            ) : (
              <p className="muted">Select a media item.</p>
            )}
          </div>
          <button data-testid="media-next" className="btn" disabled={!items.length} onClick={nextItem}>
            Next
          </button>
        </div>
      </div>
    </>
  );
}
