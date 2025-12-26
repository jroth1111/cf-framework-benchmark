import type { Candle } from "@cf-bench/dataset";

export function drawCandles(canvas: HTMLCanvasElement, candles: Candle[], opts?: { label?: string }) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "rgba(17, 24, 39, 0.55)";
  ctx.fillRect(0, 0, width, height);

  const pad = 14;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const range = max - min || 1;

  const candleW = innerW / candles.length;

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad + (innerH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(pad + innerW, y);
    ctx.stroke();
  }

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const x = pad + i * candleW + candleW * 0.5;
    const y = (v: number) => pad + ((max - v) / range) * innerH;

    const yo = y(c.o);
    const yc = y(c.c);
    const yh = y(c.h);
    const yl = y(c.l);

    const up = c.c >= c.o;
    ctx.strokeStyle = up ? "rgba(34,197,94,0.9)" : "rgba(239,68,68,0.9)";
    ctx.fillStyle = up ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)";

    ctx.beginPath();
    ctx.moveTo(x, yh);
    ctx.lineTo(x, yl);
    ctx.stroke();

    const bodyTop = Math.min(yo, yc);
    const bodyH = Math.max(2, Math.abs(yc - yo));
    const bodyW = Math.max(2, candleW * 0.6);
    ctx.fillRect(x - bodyW / 2, bodyTop, bodyW, bodyH);
  }

  if (opts?.label) {
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "600 14px ui-sans-serif, system-ui";
    ctx.fillText(opts.label, pad, pad + 16);
  }
}
