import { createLazyFileRoute } from "@tanstack/react-router";
import React, { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useChart } from "@cf-bench/chart-hooks";
import { markChartError, markChartReady, updateChartCoreMetrics } from "@cf-bench/bench-types";

type ChartModule = typeof import("@cf-bench/chart-core");
type ChartInstance = ReturnType<ChartModule["createChart"]>;

export const Route = createLazyFileRoute("/chart")({
  component: ChartPage,
});

function ChartPage() {
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
  const chartRef = useRef<ChartInstance | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [, startTransition] = useTransition();
  const deferredData = useDeferredValue(data);
  const deferredIndicators = useDeferredValue(indicators);
  const chartOptions = useMemo(
    () => ({
      initialViewport: 180,
      onStats: (stats: Parameters<typeof updateChartCoreMetrics>[0]) => {
        updateChartCoreMetrics(stats);
      },
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || chartRef.current) return;

    let cancelled = false;
    requestAnimationFrame(() => {
      void (async () => {
        try {
          const { createChart } = await import("@cf-bench/chart-core");
          if (cancelled || chartRef.current) return;
          const chart = createChart(canvas, chartOptions);
          chartRef.current = chart;

          requestAnimationFrame(() => {
            if (cancelled) return;
            chart.setIndicators(deferredIndicators);
            chart.resize();
            setChartReady(true);
            markChartReady(symbol, timeframe);
          });
        } catch (error) {
          markChartError(error instanceof Error ? error : "Chart initialization failed");
        }
      })();
    });

    return () => {
      cancelled = true;
    };
  }, [chartOptions, deferredIndicators, symbol, timeframe]);

  useEffect(() => {
    if (!deferredData || !chartRef.current) return;
    requestAnimationFrame(() => {
      chartRef.current?.setIndicators(deferredIndicators);
      chartRef.current?.setCandles(deferredData.candles);
    });
  }, [deferredData, deferredIndicators]);

  const handleSymbolChange = (nextSymbol: string) => {
    startTransition(() => {
      setSymbol(nextSymbol);
    });
  };

  const handleTimeframeChange = (nextTimeframe: string) => {
    startTransition(() => {
      setTimeframe(nextTimeframe as typeof timeframe);
    });
  };

  const handleIndicatorChange = (key: keyof typeof indicators, value: boolean) => {
    startTransition(() => {
      setIndicators((prev) => ({ ...prev, [key]: value }));
    });
  };

  return (
    <div>
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
              onChange={(event) => handleSymbolChange(event.target.value)}
            >
              {symbols.map((item) => (
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
              onChange={(event) => handleTimeframeChange(event.target.value)}
            >
              {timeframes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label className="muted small" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={indicators.sma20}
                onChange={(event) => handleIndicatorChange("sma20", event.target.checked)}
              />
              SMA20
            </label>
            <label className="muted small" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={indicators.sma50}
                onChange={(event) => handleIndicatorChange("sma50", event.target.checked)}
              />
              SMA50
            </label>
            <label className="muted small" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={indicators.ema20}
                onChange={(event) => handleIndicatorChange("ema20", event.target.checked)}
              />
              EMA20
            </label>
            <label className="muted small" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={indicators.volume}
                onChange={(event) => handleIndicatorChange("volume", event.target.checked)}
              />
              Volume
            </label>
          </div>

          <div className="muted small">{status === "loading" ? "Loading…" : status === "error" ? "Error" : "Ready"}</div>
        </div>

        <div className="muted small" style={{ marginTop: 10 }}>
          Pan: drag • Zoom: mousewheel/trackpad • Crosshair: move cursor
        </div>

        <div style={{ height: 420, marginTop: 12, position: "relative" }}>
          {!chartReady ? (
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
          ) : null}
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
    </div>
  );
}
