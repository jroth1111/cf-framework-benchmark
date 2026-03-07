import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  chartSymbols,
  chartTimeframes,
  getChartFetchOptions,
  markChartError,
  markChartReady,
  startChartSwitch,
  updateChartCoreMetrics,
} from "../../src/bench";

type ChartCoreModule = typeof import("../../src/chart-core");
type ChartInstance = ReturnType<ChartCoreModule["createChart"]>;

async function fetchCandles(symbol: string, timeframe: string, points: number) {
  const response = await fetch(
    `/api/prices?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&points=${points}`,
    getChartFetchOptions()
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as { candles: unknown[] };
}

const defaultIndicators = { sma20: true, sma50: false, ema20: false, volume: true };

export default function Page() {
  const [symbol, setSymbol] = useState("BTC");
  const [timeframe, setTimeframe] = useState<(typeof chartTimeframes)[number]>("1h");
  const [indicators, setIndicators] = useState(defaultIndicators);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [chartReady, setChartReady] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ChartInstance | null>(null);
  const deferredIndicators = useDeferredValue(indicators);

  const chartOptions = useMemo(
    () => ({
      initialViewport: 180,
      onStats: updateChartCoreMetrics,
    }),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!chartRef.current) {
      let cancelled = false;
      requestAnimationFrame(() => {
        void (async () => {
          const { createChart } = await import("../../src/chart-core");
          if (cancelled || chartRef.current) return;
          const chart = createChart(canvas, chartOptions);
          chartRef.current = chart;
          requestAnimationFrame(() => {
            if (cancelled) return;
            chart.setIndicators(deferredIndicators);
            chart.resize();
            setChartReady(true);
          });
        })();
      });
      return () => {
        cancelled = true;
      };
    }

    requestAnimationFrame(() => {
      chartRef.current?.setIndicators(deferredIndicators);
    });
  }, [chartOptions, deferredIndicators]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setStatus("loading");
      const points = timeframe === "1m" ? 900 : timeframe === "5m" ? 700 : timeframe === "15m" ? 520 : 360;
      startChartSwitch();

      try {
        const data = await fetchCandles(symbol, timeframe, points);
        if (cancelled) return;
        requestAnimationFrame(() => {
          chartRef.current?.setCandles(data.candles);
        });
        markChartReady(symbol, timeframe);
        setStatus("ready");
      } catch (error) {
        markChartError(error instanceof Error ? error : String(error));
        setStatus("error");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe]);

  const setIndicator = (key: keyof typeof indicators, value: boolean) => {
    startTransition(() => {
      setIndicators((current) => ({ ...current, [key]: value }));
    });
  };

  return (
    <>
      <h1 className="h1">Chart</h1>
      <p className="muted">Interactive chart controls with raw HTML selectors and client benchmark markers.</p>
      <div className="card chart-shell">
        <div className="chart-controls">
          <label className="pill">
            <span className="small muted">Symbol</span>
            <select
              data-testid="symbol-select"
              className="input"
              value={symbol}
              onChange={(event) => startTransition(() => setSymbol(event.target.value))}
            >
              {chartSymbols.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="pill">
            <span className="small muted">Timeframe</span>
            <select
              data-testid="timeframe-select"
              className="input"
              value={timeframe}
              onChange={(event) =>
                startTransition(() => setTimeframe(event.target.value as (typeof chartTimeframes)[number]))
              }
            >
              {chartTimeframes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="small muted">
            <input
              type="checkbox"
              checked={indicators.sma20}
              onChange={(event) => setIndicator("sma20", event.target.checked)}
            />{" "}
            SMA20
          </label>
          <label className="small muted">
            <input
              type="checkbox"
              checked={indicators.sma50}
              onChange={(event) => setIndicator("sma50", event.target.checked)}
            />{" "}
            SMA50
          </label>
          <label className="small muted">
            <input
              type="checkbox"
              checked={indicators.ema20}
              onChange={(event) => setIndicator("ema20", event.target.checked)}
            />{" "}
            EMA20
          </label>
          <label className="small muted">
            <input
              type="checkbox"
              checked={indicators.volume}
              onChange={(event) => setIndicator("volume", event.target.checked)}
            />{" "}
            Volume
          </label>
          <div className="small muted">
            {status === "loading" ? "Loading candles…" : status === "error" ? "Error loading data" : isPending ? "Updating…" : "Ready"}
          </div>
        </div>
        <div className="small muted" style={{ marginTop: 10 }}>
          Pan: drag • Zoom: wheel/trackpad • Crosshair: move cursor
        </div>
        <div className="chart-panel">
          {!chartReady && <div className="chart-loading muted">Loading chart…</div>}
          <canvas
            ref={canvasRef}
            data-testid="chart-canvas"
            className="chart-canvas"
            style={{ opacity: chartReady ? 1 : 0, transition: "opacity 0.2s ease-in-out" }}
          />
        </div>
      </div>
    </>
  );
}
