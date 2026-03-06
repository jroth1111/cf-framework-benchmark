'use client';

import { useMemo, useState } from 'react';
import type { MediaItem } from '@cf-bench/dataset';

function ensureBenchMedia() {
  const w = window as typeof window & { __CF_BENCH__?: Record<string, any> };
  w.__CF_BENCH__ = w.__CF_BENCH__ || {};
  w.__CF_BENCH__.media = w.__CF_BENCH__.media || { ready: false };
  return w.__CF_BENCH__.media;
}

export function MediaClient({ items }: { items: MediaItem[] }) {
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
    <div className="grid cols-2">
      <div className="card">
        <h2>Feed</h2>
        <div className="media-list">
          {items.map((item, index) => (
            <button
              key={item.id}
              className={`card media-card${index === selectedIndex ? ' active' : ''}`}
              data-testid="media-card"
              onClick={() => openByIndex(index)}
              type="button"
            >
              <strong>{item.title}</strong>
              <span className="muted small">
                {item.channel} • {item.publishedISO}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Player</h2>
        <div data-testid="media-player" style={{ minHeight: 280 }}>
          {selected ? (
            <>
              <img
                alt={selected.title}
                src={selected.thumbnail}
                style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 16 }}
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
        <button className="btn" data-testid="media-next" onClick={nextItem} type="button">
          Next
        </button>
      </div>
    </div>
  );
}
