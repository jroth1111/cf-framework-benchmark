import React, { useEffect, useRef, useMemo, useTransition, useDeferredValue, useState, Suspense, lazy } from "react";
import { createChart } from "@cf-bench/chart-core";
import { Layout } from "../components/Layout";
import { useChart } from "@cf-bench/chart-hooks/react";
import { markChartReady, markChartError, updateChartCoreMetrics } from "@cf-bench/bench-types";

export function Chart() {
  const {
    symbol,
    timeframe,
    indicators,
    status,
    data,
    setSymbol,
    setTimeframe,
    setIndicators,
    symbols,
    timeframes,
  } = useChart();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [isPending, startTransition] = useTransition();

  // useDeferredValue for expensive renders
  const deferredData = useDeferredValue(data);
  const deferredIndicators = useDeferredValue(indicators);

  // useMemo for chart options (prevents unnecessary recreations)
  const chartOptions = useMemo(() => ({
    initialViewport: 180,
    onStats: (stats) => {
      updateChartCoreMetrics(stats);
    },
  }), []);

  // Initialize chart instance with requestAnimationFrame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || chartRef.current) return;

    requestAnimationFrame(() => {
      try {
        const chart = createChart(canvas, chartOptions);
        chartRef.current = chart;

        requestAnimationFrame(() => {
          chart.setIndicators(indicators);
          chart.resize();
          setChartReady(true);
          markChartReady(symbol, timeframe);
        });
      } catch (err) {
        markChartError(err instanceof Error ? err : 'Chart initialization failed');
      }
    });
  }, [canvasRef, chartOptions]);

  // Update candles when data changes (use requestAnimationFrame for smooth updates)
  useEffect(() => {
    if (deferredData && chartRef.current) {
      requestAnimationFrame(() => {
        chartRef.current?.setIndicators(deferredIndicators);
        chartRef.current?.setCandles(deferredData.candles);
      });
    }
  }, [deferredData, deferredIndicators]);

  // Handle symbol change with useTransition (non-urgent updates)
  const handleSymbolChange = (newSymbol: string) => {
    startTransition(() => {
      setSymbol(newSymbol);
    });
  };

  const handleTimeframeChange = (newTimeframe: string) => {
    startTransition(() => {
      setTimeframe(newTimeframe as any);
    });
  };

  const handleIndicatorChange = (key: keyof typeof indicators, value: boolean) => {
    startTransition(() => {
      setIndicators((prev) => ({ ...prev, [key]: value }));
    });
  };

  return (
    <Layout title="Chart (SPA-like)">
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="pill">
            <span className="muted small">Symbol</span>
            <select
              data-testid="symbol-select"
              className="input"
              style={{ width: 140 }}
              value={symbol}
              onChange={(e) => handleSymbolChange(e.target.value)}
            >
              {symbols.map((s) => (
                <option key={s} value={s}>
                  {s}
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
              onChange={(e) => handleTimeframeChange(e.target.value as any)}
            >
              {timeframes.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label className="muted small" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={indicators.sma20}
                onChange={(e) => handleIndicatorChange("sma20", e.target.checked)}
              />
              SMA20
            </label>
            <label className="muted small" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={indicators.sma50}
                onChange={(e) => handleIndicatorChange("sma50", e.target.checked)}
              />
              SMA50
            </label>
            <label className="muted small" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={indicators.ema20}
                onChange={(e) => handleIndicatorChange("ema20", e.target.checked)}
              />
              EMA20
            </label>
            <label className="muted small" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={indicators.volume}
                onChange={(e) => handleIndicatorChange("volume", e.target.checked)}
              />
              Volume
            </label>
          </div>

          <div className="muted small">
            {status === "loading" ? "Loading candles…" : status === "error" ? "Error" : "Ready"}
          </div>
        </div>

        <div className="muted small" style={{ marginTop: 10 }}>
          Pan: drag • Zoom: mousewheel/trackpad • Crosshair: move cursor
        </div>

        <div style={{ height: 420, marginTop: 12, position: "relative" }}>
          {!chartReady && (
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--bg)",
              borderRadius: 12,
              border: "1px solid var(--border)"
            }}>
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
              transition: "opacity 0.2s ease-in-out"
            }}
          />
        </div>
      </div>
    </Layout>
  );
}
