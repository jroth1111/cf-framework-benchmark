import { useState, useEffect, useRef } from "hono/jsx";
import { chartSymbols } from "@cf-bench/dataset";

const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"];

declare global {
	interface Window {
		__CF_BENCH__: {
			chart?: {
				ready?: boolean;
				switchDurationMs?: number;
				symbol?: string;
				timeframe?: string;
			};
			chartCore?: { lastDrawMs?: number };
			hydration?: { startMs?: number; endMs?: number };
		};
	}
}

function drawChart(canvas: HTMLCanvasElement) {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	const { width, height } = canvas;
	ctx.clearRect(0, 0, width, height);
	ctx.fillStyle = "#0f1620";
	ctx.fillRect(0, 0, width, height);
	const bars = 90;
	for (let i = 0; i < bars; i++) {
		const x = (i * width) / bars;
		const base = Math.sin(i / 5) * 28 + Math.cos(i / 9) * 18;
		const open = height / 2 + base;
		const close = open + (Math.random() - 0.5) * 26;
		const high = Math.min(open, close) - (6 + Math.random() * 10);
		const low = Math.max(open, close) + (6 + Math.random() * 10);
		ctx.strokeStyle = close >= open ? "#2ed273" : "#ef5d5d";
		ctx.beginPath();
		ctx.moveTo(x + 4, high);
		ctx.lineTo(x + 4, low);
		ctx.stroke();
		ctx.fillStyle = close >= open ? "#2ed273" : "#ef5d5d";
		ctx.fillRect(x + 1, Math.min(open, close), 6, Math.max(2, Math.abs(close - open)));
	}
}

export default function ChartIsland() {
	const [symbol, setSymbol] = useState(chartSymbols[0]);
	const [timeframe, setTimeframe] = useState("1h");
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const w = (globalThis as typeof globalThis & { __CF_BENCH__: Window["__CF_BENCH__"] }).__CF_BENCH__ =
			(globalThis as typeof globalThis & { __CF_BENCH__: Window["__CF_BENCH__"] }).__CF_BENCH__ || {};
		const chart = (w.chart = w.chart || {});
		const core = (w.chartCore = w.chartCore || {});

		const started = performance.now();
		drawChart(canvas);
		requestAnimationFrame(() => {
			core.lastDrawMs = Math.max(1, performance.now() - started);
			chart.ready = true;
			chart.switchDurationMs = chart.switchDurationMs || 1;
			chart.symbol = symbol;
			chart.timeframe = timeframe;
		});
	}, [symbol, timeframe]);

	function handleSymbolChange(e: Event) {
		const sel = e.target as HTMLSelectElement;
		const started = performance.now();
		setSymbol(sel.value);
		requestAnimationFrame(() => {
			const w = (globalThis as typeof globalThis & { __CF_BENCH__: Window["__CF_BENCH__"] }).__CF_BENCH__;
			if (w?.chart) {
				w.chart.switchDurationMs = Math.max(1, performance.now() - started);
				w.chart.symbol = sel.value;
				w.chart.ready = true;
			}
		});
	}

	function handleTimeframeChange(e: Event) {
		const sel = e.target as HTMLSelectElement;
		const started = performance.now();
		setTimeframe(sel.value);
		requestAnimationFrame(() => {
			const w = (globalThis as typeof globalThis & { __CF_BENCH__: Window["__CF_BENCH__"] }).__CF_BENCH__;
			if (w?.chart) {
				w.chart.switchDurationMs = Math.max(1, performance.now() - started);
				w.chart.timeframe = sel.value;
				w.chart.ready = true;
			}
		});
	}

	return (
		<div class="card">
			<div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center">
				<label class="pill">
					<span class="small muted">Symbol</span>
					<select class="input" data-testid="symbol-select" value={symbol} onChange={handleSymbolChange}>
						{chartSymbols.map((s) => (
							<option value={s}>{s}</option>
						))}
					</select>
				</label>
				<label class="pill">
					<span class="small muted">Timeframe</span>
					<select class="input" data-testid="timeframe-select" value={timeframe} onChange={handleTimeframeChange}>
						{TIMEFRAMES.map((tf) => (
							<option value={tf} selected={tf === "1h"}>
								{tf}
							</option>
						))}
					</select>
				</label>
				<label class="small muted">
					<input type="checkbox" checked /> SMA20
				</label>
				<label class="small muted">
					<input type="checkbox" /> SMA50
				</label>
				<label class="small muted">
					<input type="checkbox" /> EMA20
				</label>
				<label class="small muted">
					<input type="checkbox" checked /> Volume
				</label>
			</div>
			<div style="height:420px; margin-top:12px">
				<canvas ref={canvasRef} data-testid="chart-canvas" width="1200" height="420" />
			</div>
		</div>
	);
}
