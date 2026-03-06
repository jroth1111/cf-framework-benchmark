<script setup lang="ts">
import { chartSymbols, chartTimeframes } from "@cf-bench/dataset";
import { createChart } from "@cf-bench/chart-core";
import {
  getChartFetchOptions,
  markChartError,
  markChartReady,
  startChartSwitch,
  updateChartCoreMetrics,
} from "@cf-bench/bench-types";

useBenchPage("chart");

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
let chart: ReturnType<typeof createChart> | null = null;

async function fetchCandles() {
  const points = timeframe.value === "1m" ? 900 : timeframe.value === "5m" ? 700 : timeframe.value === "15m" ? 520 : 360;
  const opts = getChartFetchOptions();
  const res = await fetch(
    `/api/prices?symbol=${encodeURIComponent(symbol.value)}&timeframe=${encodeURIComponent(timeframe.value)}&points=${points}`,
    opts
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as { candles: any[] };
}

function currentIndicators() {
  return {
    sma20: indicators.sma20,
    sma50: indicators.sma50,
    ema20: indicators.ema20,
    volume: indicators.volume,
  };
}

async function refreshChart() {
  startChartSwitch();
  status.value = "loading";
  try {
    const data = await fetchCandles();
    chart?.setIndicators(currentIndicators());
    chart?.setCandles(data.candles);
    markChartReady(symbol.value, timeframe.value);
    status.value = "ready";
  } catch (error) {
    markChartError(error instanceof Error ? error : String(error));
    status.value = "error";
  }
}

onMounted(async () => {
  if (!canvasRef.value) return;
  chart = createChart(canvasRef.value, {
    initialViewport: 180,
    onStats: (stats) => updateChartCoreMetrics(stats as never),
  });
  chart.resize();
  chartReady.value = true;
  await refreshChart();
});

watch([symbol, timeframe], async () => {
  if (!chart) return;
  await refreshChart();
});

watch(
  () => currentIndicators(),
  () => {
    chart?.setIndicators(currentIndicators());
  },
  { deep: true }
);
</script>

<template>
  <div>
    <h1 class="h1">Chart (SPA-like)</h1>
    <div class="card" style="padding: 14px">
      <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
        <div class="pill">
          <span class="muted small">Symbol</span>
          <select v-model="symbol" data-testid="symbol-select" class="input" style="width: 140px">
            <option v-for="item in chartSymbols" :key="item" :value="item">{{ item }}</option>
          </select>
        </div>

        <div class="pill">
          <span class="muted small">Timeframe</span>
          <select v-model="timeframe" data-testid="timeframe-select" class="input" style="width: 120px">
            <option v-for="item in chartTimeframes" :key="item" :value="item">{{ item }}</option>
          </select>
        </div>

        <div style="display: flex; align-items: center; gap: 10px">
          <label class="muted small" style="display: flex; gap: 6px; align-items: center">
            <input v-model="indicators.sma20" type="checkbox" />
            SMA20
          </label>
          <label class="muted small" style="display: flex; gap: 6px; align-items: center">
            <input v-model="indicators.sma50" type="checkbox" />
            SMA50
          </label>
          <label class="muted small" style="display: flex; gap: 6px; align-items: center">
            <input v-model="indicators.ema20" type="checkbox" />
            EMA20
          </label>
          <label class="muted small" style="display: flex; gap: 6px; align-items: center">
            <input v-model="indicators.volume" type="checkbox" />
            Volume
          </label>
        </div>

        <div class="muted small">{{ status === "loading" ? "Loading candles…" : status === "error" ? "Error" : "Ready" }}</div>
      </div>

      <div class="muted small" style="margin-top: 10px">
        Pan: drag • Zoom: mousewheel/trackpad • Crosshair: move cursor
      </div>

      <div style="height: 420px; margin-top: 12px; position: relative">
        <div
          v-if="!chartReady"
          style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: var(--bg); border-radius: 12px; border: 1px solid var(--border);"
        >
          <span class="muted">Loading chart…</span>
        </div>
        <canvas
          ref="canvasRef"
          data-testid="chart-canvas"
          style="width: 100%; height: 100%; border-radius: 12px; border: 1px solid var(--border)"
        />
      </div>
    </div>
  </div>
</template>
