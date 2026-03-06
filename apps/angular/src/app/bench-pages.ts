import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, OnDestroy, PLATFORM_ID, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { createChart } from '@cf-bench/chart-core';
import {
  blogPosts,
  chartSymbols,
  chartTimeframes,
  formatUsd,
  getListing,
  getPost,
  queryListings,
  queryMedia,
  type BlogPost,
  type Listing,
  type MediaItem,
} from '@cf-bench/dataset';
import {
  type BenchmarkMetrics,
  type MediaMetrics,
  getChartFetchOptions,
  markChartError,
  markChartReady,
  startChartSwitch,
  updateChartCoreMetrics,
} from '@cf-bench/bench-types';

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
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page-copy">
      <span class="eyebrow">Cloudflare Workers benchmark</span>
      <h1 class="h1">Angular on Workers</h1>
      <p class="muted">
        Native Angular SSR routes for the shared benchmark app: stays, blog, chart, and media.
      </p>
    </section>

    <section class="grid cols-2">
      <a class="card feature-card" routerLink="/stays">
        <h2>Stays</h2>
        <p class="muted">Server-rendered listing index and detail routes.</p>
      </a>
      <a class="card feature-card" routerLink="/blog">
        <h2>Blog</h2>
        <p class="muted">Static benchmark posts rendered through Angular SSR.</p>
      </a>
      <a class="card feature-card" routerLink="/chart">
        <h2>Chart</h2>
        <p class="muted">Client-side hydration with chart rendering and price fetches.</p>
      </a>
      <a class="card feature-card" routerLink="/media">
        <h2>Media</h2>
        <p class="muted">Interactive feed-to-player transitions with benchmark markers.</p>
      </a>
    </section>
  `,
})
export class HomePageComponent {}

@Component({
  selector: 'app-stays-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page-copy">
      <h1 class="h1">Stays</h1>
      <p class="muted">Airbnb-style listing index rendered by Angular on Workers.</p>
    </section>

    <section class="grid cols-3">
      <a
        *ngFor="let listing of listings"
        class="card listing-card"
        [routerLink]="['/stays', listing.id]"
        data-testid="stay-card"
      >
        <h2 class="listing-title">{{ listing.title }}</h2>
        <p class="muted small">{{ listing.city }}, {{ listing.country }}</p>
        <p class="listing-price">
          {{ formatPrice(listing.pricePerNight) }} <span class="muted">/ night</span>
        </p>
        <div class="listing-meta">
          <span>{{ listing.rating }} ★</span>
          <span>{{ listing.reviews }} reviews</span>
        </div>
      </a>
    </section>
  `,
})
export class StaysPageComponent {
  readonly listings: Listing[] = queryListings({ page: 1, pageSize: 12 }).results;

  formatPrice(value: number) {
    return formatUsd(value);
  }
}

@Component({
  selector: 'app-stay-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <ng-container *ngIf="listing as stay; else missing">
      <section class="page-copy">
        <a class="inline-link" routerLink="/stays">Back to stays</a>
        <h1 class="h1">{{ stay.title }}</h1>
        <p class="muted">
          {{ stay.neighborhood }}, {{ stay.city }} · {{ stay.maxGuests }} guests · {{ stay.bedrooms }} beds ·
          {{ stay.baths }} baths
        </p>
      </section>

      <section class="grid cols-detail">
        <article class="card detail-panel">
          <div class="meta-row">
            <span class="tag" *ngFor="let tag of stay.tags">{{ tag }}</span>
          </div>
          <div class="rich-html" data-testid="stay-description" [innerHTML]="descriptionHtml"></div>
        </article>

        <aside class="card detail-panel sidebar">
          <div class="price-block">
            <div class="listing-price">{{ formatPrice(stay.pricePerNight) }}</div>
            <div class="muted small">nightly · {{ stay.reviews }} reviews · {{ stay.rating }} ★</div>
          </div>

          <h2>Host</h2>
          <p class="muted">{{ stay.hostName }} · Host since {{ stay.hostSinceISO }}</p>

          <h2>Amenities</h2>
          <ul class="detail-list">
            <li *ngFor="let amenity of stay.amenities">{{ amenity }}</li>
          </ul>

          <h2>Review samples</h2>
          <div class="review-list">
            <article class="review-card" *ngFor="let review of stay.reviewSamples">
              <div class="review-heading">
                <strong>{{ review.name }}</strong>
                <span class="muted small">{{ review.dateISO }} · {{ review.rating }} ★</span>
              </div>
              <p class="muted">{{ review.text }}</p>
            </article>
          </div>
        </aside>
      </section>
    </ng-container>

    <ng-template #missing>
      <section class="page-copy">
        <h1 class="h1">Stay not found</h1>
      </section>
    </ng-template>
  `,
})
export class StayDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  readonly listing: Listing | null = getListing(this.route.snapshot.paramMap.get('id') ?? '') ?? null;
  readonly descriptionHtml: SafeHtml | null = this.listing
    ? this.sanitizer.bypassSecurityTrustHtml(this.listing.descriptionHtml)
    : null;

  formatPrice(value: number) {
    return formatUsd(value);
  }
}

@Component({
  selector: 'app-blog-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page-copy">
      <h1 class="h1">Blog</h1>
      <p class="muted">Static benchmark posts rendered by Angular SSR.</p>
    </section>

    <section class="blog-list">
      <a
        *ngFor="let post of posts"
        class="card blog-card"
        [routerLink]="['/blog', post.slug]"
        data-testid="blog-post-card"
      >
        <h2>{{ post.title }}</h2>
        <p class="muted small">{{ post.dateISO }} · {{ post.readingMinutes }} min read</p>
        <p class="muted">{{ post.excerpt }}</p>
        <div class="meta-row">
          <span class="tag" *ngFor="let tag of post.tags">{{ tag }}</span>
        </div>
      </a>
    </section>
  `,
})
export class BlogPageComponent {
  readonly posts: BlogPost[] = blogPosts;
}

@Component({
  selector: 'app-blog-post-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <ng-container *ngIf="post as entry; else missing">
      <section class="page-copy">
        <a class="inline-link" routerLink="/blog">Back to blog</a>
        <h1 class="h1">{{ entry.title }}</h1>
        <p class="muted">{{ entry.dateISO }} · {{ entry.readingMinutes }} min read</p>
        <div class="meta-row">
          <span class="tag" *ngFor="let tag of entry.tags">{{ tag }}</span>
        </div>
      </section>

      <article class="card detail-panel">
        <div class="rich-html" data-testid="blog-html" [innerHTML]="postHtml"></div>
      </article>
    </ng-container>

    <ng-template #missing>
      <section class="page-copy">
        <h1 class="h1">Post not found</h1>
      </section>
    </ng-template>
  `,
})
export class BlogPostPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  readonly post: BlogPost | null = getPost(this.route.snapshot.paramMap.get('slug') ?? '') ?? null;
  readonly postHtml: SafeHtml | null = this.post ? this.sanitizer.bypassSecurityTrustHtml(this.post.html) : null;
}

@Component({
  selector: 'app-chart-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page-copy">
      <h1 class="h1">Chart (SPA-like)</h1>
    </section>

    <section class="card detail-panel">
      <div class="toolbar-row">
        <label class="pill">
          <span class="muted small">Symbol</span>
          <select
            data-testid="symbol-select"
            class="input"
            [ngModel]="symbol"
            (ngModelChange)="updateSymbol($event)"
          >
            <option *ngFor="let item of symbols" [value]="item">{{ item }}</option>
          </select>
        </label>

        <label class="pill">
          <span class="muted small">Timeframe</span>
          <select
            data-testid="timeframe-select"
            class="input"
            [ngModel]="timeframe"
            (ngModelChange)="updateTimeframe($event)"
          >
            <option *ngFor="let item of timeframes" [value]="item">{{ item }}</option>
          </select>
        </label>

        <label class="toggle">
          <input type="checkbox" [ngModel]="indicators.sma20" (ngModelChange)="setIndicator('sma20', $event)" />
          <span>SMA20</span>
        </label>
        <label class="toggle">
          <input type="checkbox" [ngModel]="indicators.sma50" (ngModelChange)="setIndicator('sma50', $event)" />
          <span>SMA50</span>
        </label>
        <label class="toggle">
          <input type="checkbox" [ngModel]="indicators.ema20" (ngModelChange)="setIndicator('ema20', $event)" />
          <span>EMA20</span>
        </label>
        <label class="toggle">
          <input type="checkbox" [ngModel]="indicators.volume" (ngModelChange)="setIndicator('volume', $event)" />
          <span>Volume</span>
        </label>

        <div class="muted small">{{ statusLabel }}</div>
      </div>

      <p class="muted small">Pan: drag · Zoom: mousewheel/trackpad · Crosshair: move cursor</p>

      <div class="chart-shell">
        <div *ngIf="!chartReady" class="chart-loading">
          <span class="muted">Loading chart…</span>
        </div>
        <canvas #chartCanvas data-testid="chart-canvas" class="chart-canvas"></canvas>
      </div>
    </section>
  `,
})
export class ChartPageComponent implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private chart: ReturnType<typeof createChart> | null = null;

  @ViewChild('chartCanvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  readonly symbols = chartSymbols;
  readonly timeframes = chartTimeframes;
  readonly indicators = {
    sma20: true,
    sma50: false,
    ema20: false,
    volume: true,
  };

  symbol = 'BTC';
  timeframe: (typeof chartTimeframes)[number] = '1h';
  status: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  chartReady = false;

  get statusLabel() {
    if (this.status === 'loading') return 'Loading candles…';
    if (this.status === 'error') return 'Error';
    return 'Ready';
  }

  async ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId) || !this.canvasRef?.nativeElement) return;

    this.chart = createChart(this.canvasRef.nativeElement, {
      initialViewport: 180,
      onStats: (stats: unknown) => updateChartCoreMetrics(stats as never),
    });
    this.chart.resize();
    this.chart.setIndicators(this.currentIndicators());
    this.chartReady = true;
    await this.refreshChart();
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }

  async updateSymbol(value: string) {
    this.symbol = value;
    await this.refreshChart();
  }

  async updateTimeframe(value: (typeof chartTimeframes)[number]) {
    this.timeframe = value;
    await this.refreshChart();
  }

  setIndicator(key: keyof typeof this.indicators, value: boolean) {
    this.indicators[key] = value;
    this.chart?.setIndicators(this.currentIndicators());
  }

  private currentIndicators() {
    return {
      sma20: this.indicators.sma20,
      sma50: this.indicators.sma50,
      ema20: this.indicators.ema20,
      volume: this.indicators.volume,
    };
  }

  private pointCount() {
    if (this.timeframe === '1m') return 900;
    if (this.timeframe === '5m') return 700;
    if (this.timeframe === '15m') return 520;
    return 360;
  }

  private async refreshChart() {
    if (!isPlatformBrowser(this.platformId) || !this.chart) return;

    startChartSwitch();
    this.status = 'loading';

    try {
      const response = await fetch(
        `/api/prices?symbol=${encodeURIComponent(this.symbol)}&timeframe=${encodeURIComponent(this.timeframe)}&points=${this.pointCount()}`,
        getChartFetchOptions()
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as { candles: unknown[] };
      this.chart.setIndicators(this.currentIndicators());
      this.chart.setCandles(data.candles as never[]);
      markChartReady(this.symbol, this.timeframe);
      this.status = 'ready';
    } catch (error) {
      markChartError(error instanceof Error ? error : String(error));
      this.status = 'error';
    }
  }
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
