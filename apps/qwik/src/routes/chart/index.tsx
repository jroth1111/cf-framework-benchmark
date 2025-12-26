import { component$, useSignal, useVisibleTask$, Slot } from "@qwik.dev/core";
import { chartSymbols, chartTimeframes } from "@cf-bench/dataset";
import { createChart } from "@cf-bench/chart-core";

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

declare global {
  interface Window {
    __CF_BENCH__?: any;
    __CF_BENCH_CONFIG__?: { chartCache?: string };
  }
}

function getChartFetchOptions() {
  const mode = (globalThis as any).__CF_BENCH_CONFIG__?.chartCache;
  return mode === "no-store" ? { cache: "no-store" } : undefined;
}

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

  const chartRef = useSignal<ReturnType<typeof createChart>>();

  useVisibleTask$(async ({ track }) => {
    track(() => canvasRef.value);
    track(() => symbol.value);
    track(() => timeframe.value);
    track(() => sma20.value);
    track(() => sma50.value);
    track(() => ema20.value);
    track(() => volume.value);

    try {
      console.log('[Qwik Chart] Mounting...');
      if (!canvasRef.value) {
        throw new Error('Canvas element not found');
      }

      if (!chartRef.value) {
        chartRef.value = createChart(canvasRef.value, {
          initialViewport: 180,
          onStats: (stats) => {
            window.__CF_BENCH__ = window.__CF_BENCH__ || {};
            window.__CF_BENCH__.chartCore = stats;
          },
        });
        chartRef.value.resize();
        console.log('[Qwik Chart] Chart created');
      }

      status.value = "loading";
      const points =
        timeframe.value === "1m" ? 900 : timeframe.value === "5m" ? 700 : timeframe.value === "15m" ? 520 : 360;

      window.__CF_BENCH__ = window.__CF_BENCH__ || {};
      window.__CF_BENCH__.chart = window.__CF_BENCH__.chart || {};
      window.__CF_BENCH__.chart.switchStartTs = performance.now();

      const data = await fetchCandles(symbol.value, timeframe.value, points);
      chartRef.value?.setIndicators({
        sma20: sma20.value,
        sma50: sma50.value,
        ema20: ema20.value,
        volume: volume.value,
      });
      chartRef.value?.setCandles(data.candles);

      const end = performance.now();
      window.__CF_BENCH__.chart = {
        ...window.__CF_BENCH__.chart,
        ready: true,
        symbol: symbol.value,
        timeframe: timeframe.value,
        lastRenderTs: end,
        switchDurationMs: end - (window.__CF_BENCH__.chart.switchStartTs ?? end),
      };
      status.value = "ready";
      errorMessage.value = "";
      console.log('[Qwik Chart] Ready');
    } catch (e) {
      console.error('[Qwik Chart] Error:', e);
      const errMsg = e instanceof Error ? e.message : String(e);
      errorMessage.value = errMsg;
      status.value = "error";
      window.__CF_BENCH__ = window.__CF_BENCH__ || {};
      window.__CF_BENCH__.chart = {
        ...window.__CF_BENCH__.chart,
        ready: true,
        error: true,
        errorMessage: errMsg,
      };
    }
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
