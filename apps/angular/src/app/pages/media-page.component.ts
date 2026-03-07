import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject } from '@angular/core';
import { queryMedia, type MediaItem } from '@cf-bench/dataset';
import { type BenchmarkMetrics, type MediaMetrics } from '@cf-bench/bench-types';

function ensureBenchRoot() {
  const w = window as Window & { __CF_BENCH__?: BenchmarkMetrics };
  w.__CF_BENCH__ = w.__CF_BENCH__ || {};
  return w.__CF_BENCH__;
}

function ensureBenchMedia() {
  const root = ensureBenchRoot();
  const media: MediaMetrics = root.media || { ready: false };
  root.media = media;
  return media;
}

@Component({
  selector: 'app-media-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page-copy">
      <h1 class="h1">Media Feed (SPA-like)</h1>
    </section>

    <section class="grid cols-2">
      <div class="card detail-panel">
        <h2>Feed</h2>
        <p *ngIf="!items.length" class="muted">Failed to load media.</p>
        <div class="media-list">
          <button
            *ngFor="let item of items; let idx = index"
            type="button"
            class="card media-card"
            [class.media-card-active]="idx === selectedIndex"
            data-testid="media-card"
            (click)="openByIndex(idx)"
          >
            <div class="media-card-title">{{ item.title }}</div>
            <div class="muted small">{{ item.channel }} · {{ item.publishedISO }}</div>
          </button>
        </div>
      </div>

      <div class="card detail-panel">
        <h2>Player</h2>
        <div data-testid="media-player" class="player-shell" *ngIf="selected as active; else emptyState">
          <img class="player-image" [src]="active.thumbnail" [alt]="active.title" />
          <h3>{{ active.title }}</h3>
          <p class="muted small">{{ active.channel }} · {{ formatViews(active.views) }} views</p>
          <p class="muted">{{ active.description }}</p>
        </div>

        <ng-template #emptyState>
          <div data-testid="media-player" class="player-shell">
            <p class="muted">Select a media item.</p>
          </div>
        </ng-template>

        <button type="button" class="btn" data-testid="media-next" (click)="nextItem()" [disabled]="!items.length">
          Next
        </button>
      </div>
    </section>
  `,
})
export class MediaPageComponent {
  private readonly platformId = inject(PLATFORM_ID);

  readonly items: MediaItem[] = queryMedia({ pageSize: 30 }).results;
  selectedIndex = 0;

  constructor() {
    if (isPlatformBrowser(this.platformId) && this.selected) {
      const media = ensureBenchMedia();
      media['ready'] = true;
      media['currentId'] = this.selected.id;
    }
  }

  get selected(): MediaItem | null {
    return this.items[this.selectedIndex] ?? null;
  }

  formatViews(value: number) {
    return value.toLocaleString();
  }

  openByIndex(index: number) {
    if (!this.items[index]) return;
    const start = performance.now();
    this.selectedIndex = index;
    requestAnimationFrame(() => {
      const media = ensureBenchMedia();
      media['openDurationMs'] = performance.now() - start;
      media['ready'] = true;
      media['currentId'] = this.items[index]?.id ?? null;
    });
  }

  nextItem() {
    if (!this.items.length) return;
    const start = performance.now();
    const next = (this.selectedIndex + 1) % this.items.length;
    this.selectedIndex = next;
    requestAnimationFrame(() => {
      const media = ensureBenchMedia();
      media['nextDurationMs'] = performance.now() - start;
      media['ready'] = true;
      media['currentId'] = this.items[next]?.id ?? null;
    });
  }
}
