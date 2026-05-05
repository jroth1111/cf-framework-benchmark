import { getChartPoints } from "@cf-bench/bench-config";
import { createChart } from "@cf-bench/chart-core";
import {
	startChartSwitch,
	markChartReady,
	markChartError,
	updateChartCoreMetrics,
} from "@cf-bench/bench-types";

type ChartIndicators = {
	sma20: boolean;
	sma50: boolean;
	ema20: boolean;
	volume: boolean;
};

const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="chart-canvas"]');
const symbolSelect = document.querySelector<HTMLSelectElement>('[data-testid="symbol-select"]');
const timeframeSelect = document.querySelector<HTMLSelectElement>('[data-testid="timeframe-select"]');
const statusNode = document.querySelector<HTMLElement>('[data-testid="chart-status"]');
const indicatorInputs = Array.from(
	document.querySelectorAll<HTMLInputElement>("[data-chart-indicator]")
);

const chart = canvas
	? createChart(canvas, {
			initialViewport: 180,
			onStats: (stats) => updateChartCoreMetrics(stats),
		})
	: null;

function selectedIndicators(): ChartIndicators {
	return {
		sma20: indicatorInputs.find((input) => input.dataset.chartIndicator === "sma20")?.checked ?? true,
		sma50: indicatorInputs.find((input) => input.dataset.chartIndicator === "sma50")?.checked ?? false,
		ema20: indicatorInputs.find((input) => input.dataset.chartIndicator === "ema20")?.checked ?? false,
		volume: indicatorInputs.find((input) => input.dataset.chartIndicator === "volume")?.checked ?? true,
	};
}

async function loadChart() {
	if (!chart || !symbolSelect || !timeframeSelect) return;
	const symbol = symbolSelect.value || "BTC";
	const timeframe = timeframeSelect.value || "1h";
	const points = getChartPoints(timeframe);

	startChartSwitch();
	if (statusNode) statusNode.textContent = "Loading candles...";

	try {
		const response = await fetch(
			`/api/prices?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&points=${points}`,
			{ cache: "no-store" }
		);
		if (!response.ok) {
			throw new Error(`prices request failed: ${response.status}`);
		}
		const payload = await response.json();
		if (!Array.isArray(payload.candles)) {
			throw new Error("prices response missing candles");
		}
		chart.setIndicators(selectedIndicators());
		chart.setCandles(payload.candles);
		markChartReady(symbol, timeframe);
		if (statusNode) statusNode.textContent = `${symbol} ${timeframe}`;
	} catch (error) {
		markChartError(error instanceof Error ? error : String(error));
		if (statusNode) statusNode.textContent = "Chart unavailable";
	}
}

symbolSelect?.addEventListener("change", () => void loadChart());
timeframeSelect?.addEventListener("change", () => void loadChart());
for (const input of indicatorInputs) {
	input.addEventListener("change", () => {
		chart?.setIndicators(selectedIndicators());
		if (symbolSelect && timeframeSelect) {
			markChartReady(symbolSelect.value, timeframeSelect.value);
		}
	});
}

void loadChart();
