import { chartSymbols, chartTimeframes } from "@cf-bench/dataset";
import {
	getChartFetchOptions,
	markChartError,
	markChartReady,
	startChartSwitch,
	updateChartCoreMetrics,
} from "@cf-bench/bench-types";
import { defineComponent, h, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";

type ChartInstance = ReturnType<(typeof import("@cf-bench/chart-core"))["createChart"]>;

export default defineComponent({
	name: "ChartPage",
	setup() {
		const symbol = ref("BTC");
		const timeframe = ref<(typeof chartTimeframes)[number]>("1h");
		const indicators = reactive({
			sma20: true,
			sma50: false,
			ema20: false,
			volume: true,
		});
		const status = ref<"idle" | "loading" | "ready" | "error">("idle");
		const chartReady = ref(false);
		const canvasRef = ref<HTMLCanvasElement | null>(null);
		let chart: ChartInstance | null = null;
		let updateFrame: number | null = null;

		function scheduleChartUpdate(update: () => void) {
			if (updateFrame !== null) cancelAnimationFrame(updateFrame);
			updateFrame = requestAnimationFrame(() => {
				updateFrame = null;
				update();
			});
		}

		function currentIndicators() {
			return {
				sma20: indicators.sma20,
				sma50: indicators.sma50,
				ema20: indicators.ema20,
				volume: indicators.volume,
			};
		}

		async function fetchCandles() {
			const points =
				timeframe.value === "1m" ? 900 : timeframe.value === "5m" ? 700 : timeframe.value === "15m" ? 520 : 360;
			const opts = getChartFetchOptions();
			const res = await fetch(
				`/api/prices?symbol=${encodeURIComponent(symbol.value)}&timeframe=${encodeURIComponent(timeframe.value)}&points=${points}`,
				opts,
			);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return (await res.json()) as { candles: any[] };
		}

		async function refreshChart() {
			startChartSwitch();
			status.value = "loading";
			try {
				const data = await fetchCandles();
				scheduleChartUpdate(() => {
					chart?.setIndicators(currentIndicators());
					chart?.setCandles(data.candles);
				});
				markChartReady(symbol.value, timeframe.value);
				status.value = "ready";
			} catch (error) {
				markChartError(error instanceof Error ? error : String(error));
				status.value = "error";
			}
		}

		onMounted(async () => {
			if (!canvasRef.value) return;
			const { createChart } = await import("@cf-bench/chart-core");
			chart = createChart(canvasRef.value, {
				initialViewport: 180,
				onStats: (stats) => updateChartCoreMetrics(stats as never),
			});
			scheduleChartUpdate(() => {
				chart?.resize();
				chart?.setIndicators(currentIndicators());
				chartReady.value = true;
			});
			await refreshChart();
		});

		onBeforeUnmount(() => {
			if (updateFrame !== null) cancelAnimationFrame(updateFrame);
			chart?.destroy();
			chart = null;
		});

		watch([symbol, timeframe], async () => {
			if (!chart) return;
			await refreshChart();
		});

		watch(
			() => [indicators.sma20, indicators.sma50, indicators.ema20, indicators.volume] as const,
			() => {
				scheduleChartUpdate(() => chart?.setIndicators(currentIndicators()));
			},
		);

		return () =>
			h("div", [
				h("h1", { class: "h1" }, "Chart (SPA-like)"),
				h("div", { class: "card", style: { padding: "14px" } }, [
					h("div", { style: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" } }, [
						h("div", { class: "pill" }, [
							h("span", { class: "muted small" }, "Symbol"),
							h(
								"select",
								{
									class: "input",
									"data-testid": "symbol-select",
									style: { width: "140px" },
									value: symbol.value,
									onChange: (event: Event) => {
										symbol.value = (event.target as HTMLSelectElement).value;
									},
								},
								chartSymbols.map((item) => h("option", { key: item, value: item }, item)),
							),
						]),
						h("div", { class: "pill" }, [
							h("span", { class: "muted small" }, "Timeframe"),
							h(
								"select",
								{
									class: "input",
									"data-testid": "timeframe-select",
									style: { width: "120px" },
									value: timeframe.value,
									onChange: (event: Event) => {
										timeframe.value = (event.target as HTMLSelectElement).value as (typeof chartTimeframes)[number];
									},
								},
								chartTimeframes.map((item) => h("option", { key: item, value: item }, item)),
							),
						]),
						h("div", { style: { display: "flex", alignItems: "center", gap: "10px" } }, [
							(["sma20", "sma50", "ema20", "volume"] as const).map((key) =>
								h("label", { key, class: "muted small", style: { display: "flex", gap: "6px", alignItems: "center" } }, [
									h("input", {
										type: "checkbox",
										checked: indicators[key],
										onChange: (event: Event) => {
											indicators[key] = (event.target as HTMLInputElement).checked;
										},
									}),
									key.toUpperCase(),
								]),
							),
						]),
						h("div", { class: "muted small" }, status.value === "loading" ? "Loading candles…" : status.value === "error" ? "Error" : "Ready"),
					]),
					h("div", { class: "muted small", style: { marginTop: "10px" } }, "Pan: drag • Zoom: mousewheel/trackpad • Crosshair: move cursor"),
					h("div", { style: { height: "420px", marginTop: "12px", position: "relative" } }, [
						!chartReady.value
							? h(
									"div",
									{
										style: {
											position: "absolute",
											inset: "0",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											background: "var(--bg)",
											borderRadius: "12px",
											border: "1px solid var(--border)",
										},
									},
									h("span", { class: "muted" }, "Loading chart…"),
								)
							: null,
						h("canvas", {
							ref: canvasRef,
							"data-testid": "chart-canvas",
							style: {
								width: "100%",
								height: "100%",
								borderRadius: "12px",
								border: "1px solid var(--border)",
							},
						}),
					]),
				]),
			]);
	},
});
