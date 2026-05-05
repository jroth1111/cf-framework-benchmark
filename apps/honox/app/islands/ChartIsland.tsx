import { useState, useEffect, useRef } from "hono/jsx";
import { getChartPoints } from "@cf-bench/bench-config";
import { createChart, type ChartInstance } from "@cf-bench/chart-core";
import {
	startChartSwitch,
	markChartReady,
	markChartError,
	updateChartCoreMetrics,
} from "@cf-bench/bench-types";
import { chartSymbols, chartTimeframes } from "@cf-bench/dataset";

type Indicators = {
	sma20: boolean;
	sma50: boolean;
	ema20: boolean;
	volume: boolean;
};

declare global {
	interface Window {
		__CF_BENCH__: {
			chart?: {
				ready?: boolean;
				switchDurationMs?: number;
				symbol?: string;
				timeframe?: string;
			};
			chartCore?: { lastDrawMs?: number; drawCount?: number; pointCount?: number; indicatorCount?: number };
			hydration?: { startMs?: number; endMs?: number };
		};
	}
}

export default function ChartIsland() {
	const [symbol, setSymbol] = useState(chartSymbols[0]);
	const [timeframe, setTimeframe] = useState("1h");
	const [indicators, setIndicators] = useState<Indicators>({
		sma20: true,
		sma50: false,
		ema20: false,
		volume: true,
	});
	const [status, setStatus] = useState("Loading candles...");
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const chartRef = useRef<ChartInstance | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		if (!chartRef.current) {
			chartRef.current = createChart(canvas, {
				initialViewport: 180,
				onStats: (stats) => updateChartCoreMetrics(stats),
			});
		}

		let cancelled = false;
		const chart = chartRef.current;
		startChartSwitch();
		setStatus("Loading candles...");

		void (async () => {
			try {
				const points = getChartPoints(timeframe);
				const response = await fetch(
					`/api/prices?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&points=${points}`,
					{ cache: "no-store" }
				);
				if (!response.ok) throw new Error(`prices request failed: ${response.status}`);
				const payload = await response.json();
				if (!Array.isArray(payload.candles)) throw new Error("prices response missing candles");
				if (cancelled) return;

				chart.setIndicators(indicators);
				chart.setCandles(payload.candles);
				markChartReady(symbol, timeframe);
				setStatus(`${symbol} ${timeframe}`);
			} catch (error) {
				if (cancelled) return;
				markChartError(error instanceof Error ? error : String(error));
				setStatus("Chart unavailable");
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [symbol, timeframe, indicators]);

	function handleSymbolChange(e: Event) {
		const sel = e.target as HTMLSelectElement;
		setSymbol(sel.value);
	}

	function handleTimeframeChange(e: Event) {
		const sel = e.target as HTMLSelectElement;
		setTimeframe(sel.value);
	}

	function toggleIndicator(name: keyof Indicators) {
		setIndicators((prev) => ({ ...prev, [name]: !prev[name] }));
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
						{chartTimeframes.map((tf) => (
							<option value={tf} selected={tf === "1h"}>
								{tf}
							</option>
						))}
					</select>
				</label>
				<label class="small muted">
					<input data-testid="ind-sma20" data-chart-indicator="sma20" type="checkbox" checked={indicators.sma20} onChange={() => toggleIndicator("sma20")} /> SMA20
				</label>
				<label class="small muted">
					<input data-testid="ind-sma50" data-chart-indicator="sma50" type="checkbox" checked={indicators.sma50} onChange={() => toggleIndicator("sma50")} /> SMA50
				</label>
				<label class="small muted">
					<input data-testid="ind-ema20" data-chart-indicator="ema20" type="checkbox" checked={indicators.ema20} onChange={() => toggleIndicator("ema20")} /> EMA20
				</label>
				<label class="small muted">
					<input data-testid="ind-volume" data-chart-indicator="volume" type="checkbox" checked={indicators.volume} onChange={() => toggleIndicator("volume")} /> Volume
				</label>
				<span class="muted small" data-testid="chart-status">{status}</span>
			</div>
			<div style="height:420px; margin-top:12px">
				<canvas ref={canvasRef} data-testid="chart-canvas" width="1200" height="420" />
			</div>
		</div>
	);
}
