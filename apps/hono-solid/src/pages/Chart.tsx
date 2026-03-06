import { createEffect, onCleanup, onMount, createSignal, For, Show, ErrorBoundary } from "solid-js";
import { useChart as useChartSolid } from "@cf-bench/chart-hooks/solid";
import { markChartError, updateChartCoreMetrics } from "@cf-bench/bench-types";
import { Layout } from "../components/Layout";

type ChartModule = typeof import("@cf-bench/chart-core");
type ChartInstance = ReturnType<ChartModule["createChart"]>;

export function Chart() {
  const [error, setError] = createSignal<string | null>(null);

  return (
    <Layout title="Chart (SPA-like)">
      <ErrorBoundary
        fallback={(err) => (
          <div class="card" style="padding: 14px; border: 1px solid red; background: #fee;">
            <h2 style="color: red; margin: 0 0 8px 0;">Chart Error</h2>
            <p style="margin: 0;">{err.message || err.toString() || "Unknown error"}</p>
          </div>
        )}
      >
        <ChartInner onError={setError} />
      </ErrorBoundary>
    </Layout>
  );
}

function ChartInner(props: { onError: (error: string) => void }) {
  const {
    symbol,
    setSymbol,
    timeframe,
    setTimeframe,
    indicators,
    setIndicators,
    status,
    data,
    symbols,
    timeframes,
  } = useChartSolid();

  const [chartReady, setChartReady] = createSignal(false);
  let canvasRef: HTMLCanvasElement | undefined;
  let chart: ChartInstance | null = null;
  let initFrame: number | null = null;
  let updateFrame: number | null = null;
  let cancelled = false;

  const scheduleChartUpdate = (fn: () => void) => {
    if (updateFrame !== null) cancelAnimationFrame(updateFrame);
    updateFrame = requestAnimationFrame(() => {
      updateFrame = null;
      fn();
    });
  };

  onMount(() => {
    try {
      if (!canvasRef) {
        throw new Error("Canvas element not found");
      }

      initFrame = requestAnimationFrame(() => {
        void (async () => {
          try {
            const { createChart } = await import("@cf-bench/chart-core");
            if (cancelled || !canvasRef) return;

            chart = createChart(canvasRef, {
              initialViewport: 180,
              onStats: (stats) => updateChartCoreMetrics(stats),
            });
            chart.setIndicators(indicators());
            scheduleChartUpdate(() => {
              if (cancelled) return;
              chart?.resize();
              setChartReady(true);
            });
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : "Chart setup failed";
            props.onError(errMsg);
            markChartError(errMsg);
          }
        })();
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Chart failed to load";
      props.onError(errMsg);
      markChartError(errMsg);
    }
  });

  onCleanup(() => {
    cancelled = true;
    if (initFrame !== null) cancelAnimationFrame(initFrame);
    if (updateFrame !== null) cancelAnimationFrame(updateFrame);
    chart?.destroy();
  });

  createEffect(() => {
    const candles = data();
    const nextIndicators = indicators();

    if (candles && chart) {
      scheduleChartUpdate(() => {
        chart?.setIndicators(nextIndicators);
        chart?.setCandles(candles.candles);
      });
    }
  });

  createEffect(() => {
    const inds = indicators();
    if (chart) {
      scheduleChartUpdate(() => chart?.setIndicators(inds));
    }
  });

  return (
    <>
      <h1 class="h1">Chart (SPA-like)</h1>
      <div class="card" style="padding: 14px">
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
          <div class="pill">
            <span class="muted small">Symbol</span>
            <select
              data-testid="symbol-select"
              class="input"
              style="width: 140px"
              value={symbol()}
              onChange={(e) => setSymbol((e.target as HTMLSelectElement).value)}
            >
              <For each={symbols}>
                {(s) => (
                  <option value={s}>
                    {s}
                  </option>
                )}
              </For>
            </select>
          </div>

          <div class="pill">
            <span class="muted small">Timeframe</span>
            <select
              data-testid="timeframe-select"
              class="input"
              style="width: 120px"
              value={timeframe()}
              onChange={(e) => setTimeframe((e.target as HTMLSelectElement).value as any)}
            >
              <For each={timeframes}>
                {(tf) => (
                  <option value={tf}>
                    {tf}
                  </option>
                )}
              </For>
            </select>
          </div>

          <div style="display: flex; align-items: center; gap: 10px">
            <label class="muted small" style="display: flex; gap: 6px; align-items: center">
              <input
                type="checkbox"
                checked={indicators().sma20}
                onChange={(e) => setIndicators((prev) => ({ ...prev, sma20: (e.target as HTMLInputElement).checked }))}
              />
              SMA20
            </label>
            <label class="muted small" style="display: flex; gap: 6px; align-items: center">
              <input
                type="checkbox"
                checked={indicators().sma50}
                onChange={(e) => setIndicators((prev) => ({ ...prev, sma50: (e.target as HTMLInputElement).checked }))}
              />
              SMA50
            </label>
            <label class="muted small" style="display: flex; gap: 6px; align-items: center">
              <input
                type="checkbox"
                checked={indicators().ema20}
                onChange={(e) => setIndicators((prev) => ({ ...prev, ema20: (e.target as HTMLInputElement).checked }))}
              />
              EMA20
            </label>
            <label class="muted small" style="display: flex; gap: 6px; align-items: center">
              <input
                type="checkbox"
                checked={indicators().volume}
                onChange={(e) => setIndicators((prev) => ({ ...prev, volume: (e.target as HTMLInputElement).checked }))}
              />
              Volume
            </label>
          </div>

          <div class="muted small">
            {status() === "loading" ? "Loading…" : status() === "error" ? "Error" : "Ready"}
          </div>
        </div>

        <div class="muted small" style="margin-top: 10px">
          Pan: drag • Zoom: mousewheel/trackpad • Crosshair: move cursor
        </div>

        <div style="height: 420px; margin-top: 12px; position: relative">
          <Show when={!chartReady()}>
            <div data-testid="chart-loading" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: var(--bg); border-radius: 12px; border: 1px solid var(--border);">
              <span class="muted">Loading chart…</span>
            </div>
          </Show>
          <Show when={chartReady()}>
            <div data-testid="chart-ready" style="position: absolute; inset: 0; pointer-events: none;"></div>
          </Show>
          <Show when={status() === "error"}>
            <div data-testid="chart-error" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: var(--bg); border-radius: 12px; border: 1px solid var(--border);">
              <span class="muted">Chart error</span>
            </div>
          </Show>
          <canvas
            ref={canvasRef}
            data-testid="chart-canvas"
            style="width: 100%; height: 100%; border-radius: 12px; border: 1px solid var(--border); opacity: {chartReady() ? 1 : 0}; transition: opacity 0.2s ease-in-out;"
          />
        </div>
      </div>
    </>
  );
}
