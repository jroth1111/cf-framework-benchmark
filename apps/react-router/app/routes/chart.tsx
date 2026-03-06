import { useEffect, useMemo, useRef, useState, useTransition, useDeferredValue } from "react";
import { chartSymbols, chartTimeframes } from "../lib/data";
import { createChart } from "@cf-bench/chart-core";
import {
  getChartFetchOptions,
  markChartError,
  markChartReady,
  startChartSwitch,
  updateChartCoreMetrics,
} from "@cf-bench/bench-types";

async function fetchCandles(symbol: string, timeframe: string, points: number) {
  const opts = getChartFetchOptions();
  const res = await fetch(
    `/api/prices?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&points=${points}`,
    opts
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as { candles: any[] };
}

const defaultIndicators = { sma20: true, sma50: false, ema20: false, volume: true };

export default function ChartRoute() {
  const [symbol, setSymbol] = useState("BTC");
  const [timeframe, setTimeframe] = useState<(typeof chartTimeframes)[number]>("1h");
  const [indicators, setIndicators] = useState(defaultIndicators);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [chartReady, setChartReady] = useState(false);
  const [isPending, startTransition] = useTransition();
  const deferredIndicators = useDeferredValue(indicators);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

  const chartOptions = useMemo(
    () => ({
      initialViewport: 180,
      onStats: (stats: unknown) => updateChartCoreMetrics(stats as never),
    }),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!chartRef.current) {
      requestAnimationFrame(() => {
        const chart = createChart(canvas, chartOptions);
        chartRef.current = chart;
        requestAnimationFrame(() => {
          chart.setIndicators(deferredIndicators);
          chart.resize();
          setChartReady(true);
        });
      });
      return;
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
          chartRef.current?.setIndicators(deferredIndicators);
          chartRef.current?.setCandles(data.candles);
        });
        markChartReady(symbol, timeframe);
        setStatus("ready");
      } catch (error) {
        markChartError(error instanceof Error ? error : String(error));
        setStatus("error");
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [deferredIndicators, symbol, timeframe]);

  return (
    <>
      <h1 className="h1">Chart (SPA-like)</h1>
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="pill">
            <span className="muted small">Symbol</span>
            <select
              data-testid="symbol-select"
              className="input"
              style={{ width: 140 }}
              value={symbol}
              onChange={(event) =>
                startTransition(() => {
                  setSymbol(event.target.value);
                })
              }
            >
              {chartSymbols.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="pill">
            <span className="muted small">Timeframe</span>
            <select
              data-testid="timeframe-select"
              className="input"
              style={{ width: 120 }}
              value={timeframe}
              onChange={(event) =>
                startTransition(() => {
                  setTimeframe(event.target.value as (typeof chartTimeframes)[number]);
                })
              }
            >
              {chartTimeframes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {(["sma20", "sma50", "ema20", "volume"] as const).map((key) => (
              <label key={key} className="muted small" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={indicators[key]}
                  onChange={(event) =>
                    startTransition(() => {
                      setIndicators((prev) => ({ ...prev, [key]: event.target.checked }));
                    })
                  }
                />
                {key.toUpperCase()}
              </label>
            ))}
          </div>
          <div className="muted small">{isPending || status === "loading" ? "Loading candles…" : status === "error" ? "Error" : "Ready"}</div>
        </div>
        <div className="muted small" style={{ marginTop: 10 }}>
          Pan: drag • Zoom: mousewheel/trackpad • Crosshair: move cursor
        </div>
        <div style={{ height: 420, marginTop: 12, position: "relative" }}>
          {!chartReady && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--bg)",
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            >
              <span className="muted">Loading chart…</span>
            </div>
          )}
          <canvas
            ref={canvasRef}
            data-testid="chart-canvas"
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 12,
              border: "1px solid var(--border)",
              opacity: chartReady ? 1 : 0,
              transition: "opacity 0.2s ease-in-out",
            }}
          />
        </div>
      </div>
    </>
  );
}
