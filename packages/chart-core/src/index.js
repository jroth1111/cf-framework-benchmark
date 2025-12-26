/* eslint-disable no-mixed-operators */

// A tiny, dependency-free canvas candlestick chart intended for benchmarking.
// It intentionally does some compute per draw (indicators + hit testing) to stress the main thread.

/**
 * @typedef {import('@cf-bench/dataset').Candle} Candle
 */

/**
 * @typedef {{
 *  sma20: boolean;
 *  sma50: boolean;
 *  ema20: boolean;
 *  volume: boolean;
 * }} ChartIndicators
 */

/**
 * @typedef {{
 *  background: string;
 *  panel: string;
 *  grid: string;
 *  text: string;
 *  mutedText: string;
 *  up: string;
 *  down: string;
 *  upFill: string;
 *  downFill: string;
 *  indicator1: string;
 *  indicator2: string;
 *  indicator3: string;
 *  crosshair: string;
 *  volume: string;
 * }} ChartTheme
 */

/**
 * @typedef {{
 *  theme?: Partial<ChartTheme>;
 *  devicePixelRatio?: number;
 *  initialViewport?: number;
 *  onStats?: (stats: any) => void;
 * }} ChartOptions
 */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function defaultTheme() {
  return {
    background: "#0b1220",
    panel: "#0f172a",
    grid: "rgba(148,163,184,0.18)",
    text: "#e2e8f0",
    mutedText: "rgba(226,232,240,0.75)",
    up: "#22c55e",
    down: "#ef4444",
    upFill: "rgba(34,197,94,0.25)",
    downFill: "rgba(239,68,68,0.25)",
    indicator1: "#60a5fa",
    indicator2: "#f59e0b",
    indicator3: "#a78bfa",
    crosshair: "rgba(226,232,240,0.45)",
    volume: "rgba(148,163,184,0.5)",
  };
}

function fmt(n) {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toFixed(0);
  if (Math.abs(n) >= 10) return n.toFixed(2);
  return n.toFixed(3);
}

function sma(candles, period) {
  /** @type {Array<number|null>} */
  const out = new Array(candles.length).fill(null);
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].c;
    if (i >= period) sum -= candles[i - period].c;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function ema(candles, period) {
  /** @type {Array<number|null>} */
  const out = new Array(candles.length).fill(null);
  const k = 2 / (period + 1);
  let prev = candles[0]?.c ?? 0;
  for (let i = 0; i < candles.length; i++) {
    const val = candles[i].c;
    prev = i === 0 ? val : val * k + prev * (1 - k);
    if (i >= period - 1) out[i] = prev;
  }
  return out;
}

class CandleChart {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {ChartOptions} [opts]
   */
  constructor(canvas, opts) {
    this.canvas = canvas;
    /** @type {CanvasRenderingContext2D} */
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    this.ctx = ctx;

    const theme = { ...defaultTheme(), ...(opts?.theme || {}) };
    this.theme = theme;

    this.dpr = opts?.devicePixelRatio || (globalThis.devicePixelRatio || 1);
    this.onStats = opts?.onStats || null;

    /** @type {Candle[]} */
    this.candles = [];
    this.indicators = { sma20: true, sma50: false, ema20: false, volume: true };

    this.viewportCount = opts?.initialViewport || 180;
    this.viewportEnd = this.candles.length; // Show end of data by default

    this.crosshair = { x: -1, y: -1, visible: false };
    this.drag = { active: false, startX: 0, startEnd: 0 };

    this.stats = {
      lastDrawMs: 0,
      drawCount: 0,
      lastRenderTs: 0,
      viewportStart: 0,
      viewportEnd: 0,
      pointCount: 0,
      indicatorCount: 0,
    };

    this._resizeObserver = null;
    this._resizeFrameId = null;
    this._bound = {
      wheel: (e) => this.onWheel(e),
      down: (e) => this.onPointerDown(e),
      move: (e) => this.onPointerMove(e),
      up: () => this.onPointerUp(),
      leave: () => this.onPointerLeave(),
    };

    this.attach();
  }

  attach() {
    this.canvas.addEventListener("wheel", this._bound.wheel, { passive: false });
    this.canvas.addEventListener("pointerdown", this._bound.down);
    this.canvas.addEventListener("pointermove", this._bound.move);
    this.canvas.addEventListener("pointerup", this._bound.up);
    this.canvas.addEventListener("pointercancel", this._bound.up);
    this.canvas.addEventListener("pointerleave", this._bound.leave);

    try {
      this._resizeObserver = new ResizeObserver(() => {
        // Throttle resize events via requestAnimationFrame to avoid excessive redraws
        if (this._resizeFrameId !== null) return;
        this._resizeFrameId = requestAnimationFrame(() => {
          this._resizeFrameId = null;
          this.resize();
        });
      });
      this._resizeObserver.observe(this.canvas);
    } catch {
      // ignore
    }
  }

  destroy() {
    this.canvas.removeEventListener("wheel", this._bound.wheel);
    this.canvas.removeEventListener("pointerdown", this._bound.down);
    this.canvas.removeEventListener("pointermove", this._bound.move);
    this.canvas.removeEventListener("pointerup", this._bound.up);
    this.canvas.removeEventListener("pointercancel", this._bound.up);
    this.canvas.removeEventListener("pointerleave", this._bound.leave);
    try { this._resizeObserver?.disconnect(); } catch { }
    if (this._resizeFrameId !== null) {
      cancelAnimationFrame(this._resizeFrameId);
      this._resizeFrameId = null;
    }
  }

  getStats() {
    return { ...this.stats };
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(240, Math.floor(rect.height));
    const dpr = this.dpr || 1;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.draw();
  }

  /** @param {Candle[]} candles */
  setCandles(candles) {
    this.candles = candles || [];
    this.viewportEnd = this.candles.length;
    this.viewportCount = clamp(this.viewportCount, 30, Math.max(30, this.candles.length));
    this._recalcIndicators();
    this.draw();
  }

  /** @param {Partial<ChartIndicators>} indicators */
  setIndicators(indicators) {
    this.indicators = { ...this.indicators, ...(indicators || {}) };
    this._recalcIndicators();
    this.draw();
  }

  /** @param {number} endIndex @param {number} count */
  setViewport(endIndex, count) {
    const len = this.candles.length;
    const c = clamp(Math.floor(count), 30, Math.max(30, len));
    const end = clamp(Math.floor(endIndex), c, len);
    this.viewportCount = c;
    this.viewportEnd = end;
    this.draw();
  }

  _recalcIndicators() {
    const candles = this.candles;
    this._sma20 = this.indicators.sma20 ? sma(candles, 20) : null;
    this._sma50 = this.indicators.sma50 ? sma(candles, 50) : null;
    this._ema20 = this.indicators.ema20 ? ema(candles, 20) : null;
  }

  /** @param {WheelEvent} e */
  onWheel(e) {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    const factor = dir > 0 ? 1.1 : 0.9;
    const nextCount = clamp(Math.floor(this.viewportCount * factor), 30, Math.max(30, this.candles.length));

    const rect = this.canvas.getBoundingClientRect();
    const relX = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const start = Math.max(0, this.viewportEnd - this.viewportCount);
    const centerIndex = start + Math.floor(relX * this.viewportCount);

    const nextStart = clamp(centerIndex - Math.floor(nextCount * relX), 0, Math.max(0, this.candles.length - nextCount));
    this.viewportCount = nextCount;
    this.viewportEnd = nextStart + nextCount;
    this.draw();
  }

  /** @param {PointerEvent} e */
  onPointerDown(e) {
    this.canvas.setPointerCapture?.(e.pointerId);
    this.drag.active = true;
    this.drag.startX = e.clientX;
    this.drag.startEnd = this.viewportEnd;
  }

  /** @param {PointerEvent} e */
  onPointerMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * this.dpr;
    const y = (e.clientY - rect.top) * this.dpr;
    this.crosshair.x = x;
    this.crosshair.y = y;
    this.crosshair.visible = true;

    if (this.drag.active) {
      const dx = e.clientX - this.drag.startX;
      const perCandlePx = Math.max(2, rect.width / this.viewportCount);
      const shift = Math.round(dx / perCandlePx);
      const end = clamp(this.drag.startEnd - shift, this.viewportCount, this.candles.length);
      this.viewportEnd = end;
    }
    this.draw();
  }

  onPointerUp() {
    this.drag.active = false;
  }

  onPointerLeave() {
    this.drag.active = false;
    this.crosshair.visible = false;
    this.draw();
  }

  draw() {
    const t0 = performance.now();
    const dpr = this.dpr || 1;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = this.theme.background;
    ctx.fillRect(0, 0, w, h);

    const pad = 14 * dpr;
    const volH = this.indicators.volume ? Math.max(20 * dpr, Math.floor(h * 0.22)) : 0;
    const mainH = h - volH - pad * 2;
    const mainTop = pad;
    const volTop = mainTop + mainH + pad;

    ctx.fillStyle = this.theme.panel;
    ctx.fillRect(pad, mainTop, w - pad * 2, mainH);
    if (volH) ctx.fillRect(pad, volTop, w - pad * 2, volH);

    const candles = this.candles;
    const len = candles.length;
    if (!len) {
      ctx.fillStyle = this.theme.text;
      ctx.font = `${12 * dpr}px ui-sans-serif, system-ui`;
      ctx.fillText("No data", pad + 8, mainTop + 24);
      ctx.restore();
      this._commitStats(t0, 0, 0, 0);
      return;
    }

    const count = clamp(this.viewportCount, 30, len);
    const end = clamp(this.viewportEnd || len, count, len);
    const start = Math.max(0, end - count);
    const view = candles.slice(start, end);

    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < view.length; i++) {
      const c = view[i];
      min = Math.min(min, c.l);
      max = Math.max(max, c.h);
    }
    const include = (arr) => {
      if (!arr) return;
      for (let i = start; i < end; i++) {
        const v = arr[i];
        if (v == null) continue;
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    };
    include(this._sma20);
    include(this._sma50);
    include(this._ema20);

    const span = Math.max(0.0001, max - min);
    min -= span * 0.06;
    max += span * 0.06;

    const plotW = w - pad * 2;
    const plotH = mainH;
    const x0 = pad;
    const y0 = mainTop;

    const candleW = Math.max(2 * dpr, plotW / count);
    const bodyW = Math.max(1 * dpr, candleW * 0.62);

    ctx.strokeStyle = this.theme.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const y = y0 + (plotH * i) / 5;
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + plotW, y);
    }
    for (let i = 0; i <= 8; i++) {
      const x = x0 + (plotW * i) / 8;
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y0 + plotH);
    }
    ctx.stroke();

    let maxVol = 1;
    if (volH) {
      for (let i = 0; i < view.length; i++) maxVol = Math.max(maxVol, view[i].v);
    }

    for (let i = 0; i < view.length; i++) {
      const c = view[i];
      const x = x0 + i * candleW + candleW / 2;
      const yHigh = y0 + (1 - (c.h - min) / (max - min)) * plotH;
      const yLow = y0 + (1 - (c.l - min) / (max - min)) * plotH;
      const yOpen = y0 + (1 - (c.o - min) / (max - min)) * plotH;
      const yClose = y0 + (1 - (c.c - min) / (max - min)) * plotH;

      const up = c.c >= c.o;
      ctx.strokeStyle = up ? this.theme.up : this.theme.down;
      ctx.fillStyle = up ? this.theme.upFill : this.theme.downFill;

      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      const top = Math.min(yOpen, yClose);
      const bot = Math.max(yOpen, yClose);
      const bw = bodyW;
      ctx.fillRect(x - bw / 2, top, bw, Math.max(1 * dpr, bot - top));
      ctx.strokeRect(x - bw / 2, top, bw, Math.max(1 * dpr, bot - top));

      if (volH) {
        const vh = (c.v / maxVol) * (volH - 12 * dpr);
        const vx = x - bw / 2;
        const vy = volTop + volH - vh;
        ctx.fillStyle = this.theme.volume;
        ctx.fillRect(vx, vy, bw, vh);
      }

      // Intentional CPU stress: perform a throwaway calculation per candle to
      // simulate realistic per-item processing overhead during benchmarks.
      Math.sqrt((i + 1) * c.c);
    }

    const drawLine = (arr, color) => {
      if (!arr) return 0;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6 * dpr;
      ctx.beginPath();
      let started = false;
      for (let i = start; i < end; i++) {
        const v = arr[i];
        if (v == null) continue;
        const j = i - start;
        const x = x0 + j * candleW + candleW / 2;
        const y = y0 + (1 - (v - min) / (max - min)) * plotH;
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();
      return 1;
    };

    let indCount = 0;
    indCount += drawLine(this._sma20, this.theme.indicator1);
    indCount += drawLine(this._sma50, this.theme.indicator2);
    indCount += drawLine(this._ema20, this.theme.indicator3);

    ctx.fillStyle = this.theme.mutedText;
    ctx.font = `${11 * dpr}px ui-sans-serif, system-ui`;
    for (let i = 0; i <= 5; i++) {
      const p = max - (span * i) / 5;
      const y = y0 + (plotH * i) / 5;
      ctx.fillText(fmt(p), x0 + 6 * dpr, y + 12 * dpr);
    }

    if (this.crosshair.visible) {
      const cx = clamp(this.crosshair.x, x0, x0 + plotW);
      const cy = clamp(this.crosshair.y, y0, y0 + plotH);
      ctx.strokeStyle = this.theme.crosshair;
      ctx.lineWidth = 1;
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.beginPath();
      ctx.moveTo(cx, y0);
      ctx.lineTo(cx, y0 + plotH);
      ctx.moveTo(x0, cy);
      ctx.lineTo(x0 + plotW, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      const idx = clamp(Math.floor((cx - x0) / candleW), 0, view.length - 1);
      const c = view[idx];
      const boxW = 200 * dpr;
      const boxH = 72 * dpr;
      const bx = clamp(cx + 10 * dpr, x0, x0 + plotW - boxW);
      const by = clamp(cy + 10 * dpr, y0, y0 + plotH - boxH);

      ctx.fillStyle = "rgba(15,23,42,0.9)";
      ctx.fillRect(bx, by, boxW, boxH);
      ctx.strokeStyle = "rgba(148,163,184,0.2)";
      ctx.strokeRect(bx, by, boxW, boxH);

      ctx.fillStyle = this.theme.text;
      ctx.font = `${11 * dpr}px ui-sans-serif, system-ui`;
      ctx.fillText(`O ${fmt(c.o)}  H ${fmt(c.h)}`, bx + 8 * dpr, by + 22 * dpr);
      ctx.fillText(`L ${fmt(c.l)}  C ${fmt(c.c)}`, bx + 8 * dpr, by + 40 * dpr);
      if (volH) ctx.fillText(`V ${c.v}`, bx + 8 * dpr, by + 58 * dpr);
    }

    ctx.restore();
    this._commitStats(t0, start, end, indCount);
  }

  _commitStats(t0, start, end, indCount) {
    const t1 = performance.now();
    this.stats.lastDrawMs = t1 - t0;
    this.stats.drawCount += 1;
    this.stats.lastRenderTs = t1;
    this.stats.viewportStart = start;
    this.stats.viewportEnd = end;
    this.stats.pointCount = Math.max(0, end - start);
    this.stats.indicatorCount = indCount;
    if (this.onStats) this.onStats(this.getStats());
  }
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {ChartOptions} [opts]
 */
export function createChart(canvas, opts) {
  const chart = new CandleChart(canvas, opts);
  return {
    setCandles: (candles) => chart.setCandles(candles),
    setIndicators: (indicators) => chart.setIndicators(indicators),
    setViewport: (end, count) => chart.setViewport(end, count),
    resize: () => chart.resize(),
    destroy: () => chart.destroy(),
    getStats: () => chart.getStats(),
  };
}
