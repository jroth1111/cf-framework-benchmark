'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { chartSymbols, chartTimeframes } from '@cf-bench/dataset';
import { createChart } from '@cf-bench/chart-core';
import {
  getChartFetchOptions,
  markChartError,
  markChartReady,
  startChartSwitch,
  updateChartCoreMetrics,
} from '@cf-bench/bench-types';

async function fetchCandles(symbol: string, timeframe: string, points: number) {
  const response = await fetch(
    `/api/prices?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&points=${points}`,
    getChartFetchOptions()
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<{ candles: unknown[] }>;
}

const initialIndicators = { sma20: true, sma50: false, ema20: false, volume: true };

export function ChartClient() {
  const [symbol, setSymbol] = useState('BTC');
  const [timeframe, setTimeframe] = useState<(typeof chartTimeframes)[number]>('1h');
  const [indicators, setIndicators] = useState(initialIndicators);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [ready, setReady] = useState(false);
  const [isPending, startTransition] = useTransition();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const symbols = useMemo(() => chartSymbols, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || chartRef.current) return;
    const chart = createChart(canvas, {
      initialViewport: 180,
      onStats: (stats) => updateChartCoreMetrics(stats),
    });
    chartRef.current = chart;
    chart.setIndicators(indicators);
    chart.resize();
    setReady(true);
  }, []);

  useEffect(() => {
    chartRef.current?.setIndicators(indicators);
  }, [indicators]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setStatus('loading');
      startChartSwitch();
      const points = timeframe === '1m' ? 900 : timeframe === '5m' ? 700 : timeframe === '15m' ? 520 : 360;

      try {
        const data = await fetchCandles(symbol, timeframe, points);
        if (cancelled) return;
        chartRef.current?.setIndicators(indicators);
        chartRef.current?.setCandles(data.candles as never[]);
        markChartReady(symbol, timeframe);
        setStatus('ready');
      } catch (error) {
        markChartError(error instanceof Error ? error : String(error));
        setStatus('error');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, indicators]);

  return (
    <div className="card">
      <div className="toolbar">
        <label className="pill">
          <span className="muted small">Symbol</span>
          <select
            className="input"
            data-testid="symbol-select"
            style={{ width: 140 }}
            value={symbol}
            onChange={(event) => startTransition(() => setSymbol(event.target.value))}
          >
            {symbols.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="pill">
          <span className="muted small">Timeframe</span>
          <select
            className="input"
            data-testid="timeframe-select"
            style={{ width: 120 }}
            value={timeframe}
            onChange={(event) =>
              startTransition(() => setTimeframe(event.target.value as (typeof chartTimeframes)[number]))
            }
          >
            {chartTimeframes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="muted small">
          <input
            checked={indicators.sma20}
            onChange={(event) => startTransition(() => setIndicators((prev) => ({ ...prev, sma20: event.target.checked })))}
            type="checkbox"
          />
          SMA20
        </label>
        <label className="muted small">
          <input
            checked={indicators.sma50}
            onChange={(event) => startTransition(() => setIndicators((prev) => ({ ...prev, sma50: event.target.checked })))}
            type="checkbox"
          />
          SMA50
        </label>
        <label className="muted small">
          <input
            checked={indicators.ema20}
            onChange={(event) => startTransition(() => setIndicators((prev) => ({ ...prev, ema20: event.target.checked })))}
            type="checkbox"
          />
          EMA20
        </label>
        <label className="muted small">
          <input
            checked={indicators.volume}
            onChange={(event) => startTransition(() => setIndicators((prev) => ({ ...prev, volume: event.target.checked })))}
            type="checkbox"
          />
          Volume
        </label>
        <span className="muted small">
          {status === 'loading' ? 'Loading candles…' : status === 'error' ? 'Error' : isPending ? 'Updating…' : 'Ready'}
        </span>
      </div>

      <p className="muted small section">Pan: drag. Zoom: wheel or trackpad. Crosshair: hover.</p>
      <div className="chart-wrap">
        {!ready ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(244, 239, 230, 0.92)',
              borderRadius: 18,
            }}
          >
            <span className="muted">Loading chart…</span>
          </div>
        ) : null}
        <canvas data-testid="chart-canvas" className="chart-canvas" ref={canvasRef} width={1200} height={420} />
      </div>
    </div>
  );
}
