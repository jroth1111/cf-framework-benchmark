import { chartSymbols, chartTimeframes, type Candle } from "@cf-bench/dataset";
import { createChart } from "@cf-bench/chart-core";
import { startChartSwitch, markChartReady, markChartError, getChartFetchOptions, updateChartCoreMetrics } from "@cf-bench/bench-types";
import { getChartPoints, TEST_SELECTORS, DEFAULT_CHART_CONFIG } from "@cf-bench/bench-config";

async function fetchCandles(symbol: string, timeframe: string, points: number) {
  const opts = getChartFetchOptions();
  const r = await fetch(
    `/api/prices?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&points=${points}`,
    opts
  );
  
  if (!r.ok) {
    const errorText = await r.text();
    throw new Error(`Failed to fetch candles for ${symbol}/${timeframe}: HTTP ${r.status} - ${errorText}`);
  }

  const data = await r.json();

  if (!data.symbol || !Array.isArray(data.candles)) {
    throw new Error(`Invalid response format for ${symbol}/${timeframe}: missing symbol or candles array`);
  }

  return data as { symbol: string; timeframe: string; candles: Candle[] };
}

export async function mountChart() {
  const symbolSel = document.querySelector(TEST_SELECTORS.symbolSelect) as HTMLSelectElement | null;
  const tfSel = document.querySelector(TEST_SELECTORS.timeframeSelect) as HTMLSelectElement | null;
  const canvas = document.querySelector(TEST_SELECTORS.chartCanvas) as HTMLCanvasElement | null;
  
  if (!symbolSel || !tfSel || !canvas) {
    console.warn("Chart elements not found:", { symbolSel: !!symbolSel, tfSel: !!tfSel, canvas: !!canvas });
    return;
  }

  const indSma20 = document.querySelector(TEST_SELECTORS.indicatorSma20) as HTMLInputElement | null;
  const indSma50 = document.querySelector(TEST_SELECTORS.indicatorSma50) as HTMLInputElement | null;
  const indEma20 = document.querySelector(TEST_SELECTORS.indicatorEma20) as HTMLInputElement | null;
  const indVol = document.querySelector(TEST_SELECTORS.indicatorVolume) as HTMLInputElement | null;

  // Populate symbol select
  symbolSel.innerHTML = "";
  for (const s of chartSymbols) {
    const o = document.createElement("option");
    o.value = s;
    o.textContent = s;
    symbolSel.appendChild(o);
  }

  // Populate timeframe select
  tfSel.innerHTML = "";
  for (const tf of chartTimeframes) {
    const o = document.createElement("option");
    o.value = tf;
    o.textContent = tf;
    tfSel.appendChild(o);
  }

  // Create chart instance
  const chart = createChart(canvas, {
    initialViewport: DEFAULT_CHART_CONFIG.initialViewport,
    onStats: (stats) => {
      updateChartCoreMetrics(stats);
    },
  });
  chart.resize();

  const getIndicators = () => ({
    sma20: !!indSma20?.checked,
    sma50: !!indSma50?.checked,
    ema20: !!indEma20?.checked,
    volume: !!indVol?.checked,
  });

  let currentSymbol = DEFAULT_CHART_CONFIG.initialSymbol;
  let currentTimeframe = DEFAULT_CHART_CONFIG.initialTimeframe;

  async function render() {
    const symbol = symbolSel.value || DEFAULT_CHART_CONFIG.initialSymbol;
    const timeframe = tfSel.value || DEFAULT_CHART_CONFIG.initialTimeframe;
    const points = getChartPoints(timeframe);

    startChartSwitch();

    try {
      const data = await fetchCandles(symbol, timeframe, points);
      chart.setIndicators(getIndicators());
      chart.setCandles(data.candles);

      markChartReady(symbol, timeframe);
      currentSymbol = symbol;
      currentTimeframe = timeframe;
    } catch (e) {
      console.error(e);
      markChartError(e instanceof Error ? e : String(e));
    }
  }

  // Initial render
  symbolSel.value = DEFAULT_CHART_CONFIG.initialSymbol;
  tfSel.value = DEFAULT_CHART_CONFIG.initialTimeframe;
  await render();

  // Event listeners
  symbolSel.addEventListener("change", () => render().catch(console.error));
  tfSel.addEventListener("change", () => render().catch(console.error));
  
  const indicatorInputs = [indSma20, indSma50, indEma20, indVol].filter(Boolean) as HTMLInputElement[];
  for (const input of indicatorInputs) {
    input.addEventListener("change", () => {
      chart.setIndicators(getIndicators());
      markChartReady(currentSymbol, currentTimeframe);
    });
  }
}

mountChart().catch(console.error);
