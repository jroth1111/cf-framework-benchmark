import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, ElementRef, OnDestroy, PLATFORM_ID, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { chartSymbols, chartTimeframes } from '@cf-bench/dataset';
import {
  getChartFetchOptions,
  markChartError,
  markChartReady,
  startChartSwitch,
  updateChartCoreMetrics,
} from '@cf-bench/bench-types';

type ChartModule = typeof import('@cf-bench/chart-core');
type ChartInstance = ReturnType<ChartModule['createChart']>;

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
  private chart: ChartInstance | null = null;
  private destroyed = false;

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

    const { createChart } = await import('@cf-bench/chart-core');
    if (this.destroyed || !this.canvasRef?.nativeElement) return;

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
    this.destroyed = true;
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
