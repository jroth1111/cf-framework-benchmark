import React, { useEffect, useRef, useState } from "react";
import { createChart } from "@cf-bench/chart-core";
import { Layout } from "../components/Layout";
import { useChart } from "@cf-bench/chart-hooks";

/**
 * Improved Chart Component
 * Uses shared hooks to eliminate duplicate code and provide type safety
 */
export function ChartImproved() {
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

  // Initialize and update chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!chartRef.current) {
      chartRef.current = createChart(canvas, {
        initialViewport: 180,
        onStats: (stats) => {
          const { updateChartCoreMetrics } = require("@cf-bench/bench-types");
          updateChartCoreMetrics(stats);
        },
      });
    }

    chartRef.current.setIndicators(indicators);
    chartRef.current.resize();
  }, [indicators]);

  // Update candles when data changes
  useEffect(() => {
    if (data && chartRef.current) {
      chartRef.current.setIndicators(indicators);
      chartRef.current.setCandles(data.candles);
    }
  }, [data, indicators]);

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
              onChange={(e) => setSymbol(e.target.value)}
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
              onChange={(e) => setTimeframe(e.target.value as any)}
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
                onChange={(e) => setIndicators((prev) => ({ ...prev, sma20: e.target.checked }))}
              />
              SMA20
            </label>
            <label className="muted small" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={indicators.sma50}
                onChange={(e) => setIndicators((prev) => ({ ...prev, sma50: e.target.checked }))}
              />
              SMA50
            </label>
            <label className="muted small" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={indicators.ema20}
                onChange={(e) => setIndicators((prev) => ({ ...prev, ema20: e.target.checked }))}
              />
              EMA20
            </label>
            <label className="muted small" style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={indicators.volume}
                onChange={(e) => setIndicators((prev) => ({ ...prev, volume: e.target.checked }))}
              />
              Volume
            </label>
          </div>

          <div className="muted small">
            {status === "loading" && "Loading candles…"}
            {status === "error" && "Error loading data"}
            {status === "ready" && "Ready"}
          </div>
        </div>

        <div className="muted small" style={{ marginTop: 10 }}>
          Pan: drag • Zoom: mousewheel/trackpad • Crosshair: move cursor
        </div>

        <div style={{ height: 420, marginTop: 12 }}>
          <canvas
            ref={canvasRef}
            data-testid="chart-canvas"
            style={{ width: "100%", height: "100%", borderRadius: 12, border: "1px solid var(--border)" }}
          />
        </div>
      </div>
    </Layout>
  );
}
