import { useMemo, useState } from "react";
import { useData } from "vike-react/useData";
import type { Data } from "./+data";

function ensureBenchMedia() {
  const w = window as Window & {
    __CF_BENCH__?: {
      media?: {
        currentId?: string | null;
        openDurationMs?: number;
        nextDurationMs?: number;
        ready?: boolean;
      };
    };
  };
  w.__CF_BENCH__ = w.__CF_BENCH__ || {};
  w.__CF_BENCH__.media = w.__CF_BENCH__.media || { ready: false };
  return w.__CF_BENCH__.media;
}

export default function Page() {
  const { items } = useData<Data>();
  const [selectedIndex, setSelectedIndex] = useState(0);
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
      <h1 className="h1">Media</h1>
      <p className="muted">SSR markers first, client-side open and next timings after hydration.</p>
      <div className="grid cols-2 media-grid">
        <div className="card media-shell">
          <h2 style={{ marginTop: 0 }}>Feed</h2>
          <div className="media-list">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                data-testid="media-card"
                className={index === selectedIndex ? "btn media-item-button selected" : "btn media-item-button"}
                onClick={() => openByIndex(index)}
              >
                <div>
                  <strong>{item.title}</strong>
                </div>
                <div className="muted small">
                  {item.channel} • {item.publishedISO}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="card media-shell">
          <h2 style={{ marginTop: 0 }}>Player</h2>
          <div data-testid="media-player">
            {selected ? (
              <>
                <img className="media-player-image" src={selected.thumbnail} alt={selected.title} />
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
          <button type="button" data-testid="media-next" className="btn" onClick={nextItem} disabled={!items.length}>
            Next
          </button>
        </div>
      </div>
    </>
  );
}
