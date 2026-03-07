import { component$, useSignal, useTask$, useVisibleTask$ } from "@qwik.dev/core";
import { chartSymbols, chartTimeframes } from "@cf-bench/dataset";
import { markChartReady, markChartError, updateChartCoreMetrics, startChartSwitch, getChartFetchOptions } from "@cf-bench/bench-types";

type ChartModule = typeof import("@cf-bench/chart-core");
type ChartInstance = ReturnType<ChartModule["createChart"]>;

// Error boundary component for Qwik
export const ChartErrorBoundary = component$<{ error: any }>((props) => {
  return (
    <div class="card" style="padding: 14px; border: 1px solid red; background: #fee;">
      <h2 style="color: red; margin: 0 0 8px 0;">Chart Error</h2>
      <p style="margin: 0;">
        {props.error instanceof Error
          ? props.error.message
          : typeof props.error === "string"
          ? props.error
          : "An unknown error occurred"}
      </p>
    </div>
  );
});

async function fetchCandles(symbol: string, timeframe: string, points: number) {
  const opts = getChartFetchOptions();
  const r = await fetch(
    `/api/prices?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&points=${points}`,
    opts
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as { symbol: string; timeframe: string; candles: any[] };
}

export default component$(() => {
  const symbol = useSignal("BTC");
  const timeframe = useSignal<(typeof chartTimeframes)[number]>("1h");

  const sma20 = useSignal(true);
  const sma50 = useSignal(false);
  const ema20 = useSignal(false);
  const volume = useSignal(true);

  const status = useSignal<"idle" | "loading" | "ready" | "error">("idle");
  const errorMessage = useSignal<string>("");
  const canvasRef = useSignal<HTMLCanvasElement>();
  const chartRef = useSignal<ChartInstance>();
  const requestSeq = useSignal(0);

  const currentIndicators = () => ({
    sma20: sma20.value,
    sma50: sma50.value,
    ema20: ema20.value,
    volume: volume.value,
  });

  useVisibleTask$(async ({ track }) => {
    const canvas = track(() => canvasRef.value);
    if (!canvas || chartRef.value) return;

    try {
      const { createChart } = await import("@cf-bench/chart-core");
      if (chartRef.value) return;
      chartRef.value = createChart(canvas, {
        initialViewport: 180,
        onStats: (stats) => {
          updateChartCoreMetrics(stats);
        },
      });
      chartRef.value.resize();
      errorMessage.value = "";
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      errorMessage.value = errMsg;
      status.value = "error";
      markChartError(errMsg);
    }
  });

  useTask$(async ({ track }) => {
    const chart = track(() => chartRef.value);
    const currentSymbol = track(() => symbol.value);
    const currentTimeframe = track(() => timeframe.value);
    if (!chart) return;

    const seq = ++requestSeq.value;
    status.value = "loading";
    errorMessage.value = "";
    startChartSwitch();

    const points =
      currentTimeframe === "1m" ? 900 : currentTimeframe === "5m" ? 700 : currentTimeframe === "15m" ? 520 : 360;

    try {
      const data = await fetchCandles(currentSymbol, currentTimeframe, points);
      if (requestSeq.value !== seq || chartRef.value !== chart) return;
      chart.setCandles(data.candles);
      markChartReady(currentSymbol, currentTimeframe);
      status.value = "ready";
    } catch (e) {
      if (requestSeq.value !== seq) return;
      const errMsg = e instanceof Error ? e.message : String(e);
      errorMessage.value = errMsg;
      status.value = "error";
      markChartError(errMsg);
    }
  });

  useTask$(({ track }) => {
    const chart = track(() => chartRef.value);
    track(() => sma20.value);
    track(() => sma50.value);
    track(() => ema20.value);
    track(() => volume.value);
    if (!chart) return;
    chart.setIndicators(currentIndicators());
  });

  return (
    <div>
      <h1 class="h1">Chart (SPA-like)</h1>

      {errorMessage.value && (
        <ChartErrorBoundary error={errorMessage.value} />
      )}

      <div class="card" style="padding:14px">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <div class="pill">
            <span class="muted small">Symbol</span>
            <select
              data-testid="symbol-select"
              class="input"
              style="width:140px"
              value={symbol.value}
              onChange$={(e) => (symbol.value = (e.target as HTMLSelectElement).value)}
            >
              {chartSymbols.map((s) => (
                <option value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div class="pill">
            <span class="muted small">Timeframe</span>
            <select
              data-testid="timeframe-select"
              class="input"
              style="width:120px"
              value={timeframe.value}
              onChange$={(e) => (timeframe.value = (e.target as HTMLSelectElement).value as any)}
            >
              {chartTimeframes.map((tf) => (
                <option value={tf}>{tf}</option>
              ))}
            </select>
          </div>

          <div style="display:flex;align-items:center;gap:10px">
            <label class="muted small" style="display:flex;gap:6px;align-items:center">
              <input type="checkbox" checked={sma20.value} onChange$={(e) => (sma20.value = (e.target as HTMLInputElement).checked)} />
              SMA20
            </label>
            <label class="muted small" style="display:flex;gap:6px;align-items:center">
              <input type="checkbox" checked={sma50.value} onChange$={(e) => (sma50.value = (e.target as HTMLInputElement).checked)} />
              SMA50
            </label>
            <label class="muted small" style="display:flex;gap:6px;align-items:center">
              <input type="checkbox" checked={ema20.value} onChange$={(e) => (ema20.value = (e.target as HTMLInputElement).checked)} />
              EMA20
            </label>
            <label class="muted small" style="display:flex;gap:6px;align-items:center">
              <input type="checkbox" checked={volume.value} onChange$={(e) => (volume.value = (e.target as HTMLInputElement).checked)} />
              Volume
            </label>
          </div>

          <div class="muted small">
            {status.value === "loading" ? "Loading…" : status.value === "error" ? "Error" : "Ready"}
          </div>
        </div>

        <div class="muted small" style="margin-top:10px">
          Pan: drag • Zoom: mousewheel/trackpad • Crosshair: move cursor
        </div>

        <div style="height:420px;margin-top:12px;position:relative">
          {status.value === "loading" && (
            <div data-testid="chart-loading" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: var(--bg); border-radius: 12px; border: 1px solid var(--border);">
              <span class="muted">Loading chart…</span>
            </div>
          )}
          {status.value === "ready" && (
            <div data-testid="chart-ready" style="position: absolute; inset: 0; pointer-events: none;"></div>
          )}
          {status.value === "error" && (
            <div data-testid="chart-error" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: var(--bg); border-radius: 12px; border: 1px solid var(--border);">
              <span class="muted">Chart error: {errorMessage.value || "Unknown error"}</span>
            </div>
          )}
          <canvas
            data-testid="chart-canvas"
            ref={canvasRef}
            style="width:100%;height:100%;border-radius:12px;border:1px solid var(--border);opacity:{status.value === 'ready' ? 1 : 0};transition:opacity 0.2s ease-in-out;"
          />
        </div>
      </div>
    </div>
  );
});
