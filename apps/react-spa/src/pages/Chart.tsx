import { useEffect, useMemo, useRef, useState, useTransition, useDeferredValue } from "react";
import { chartSymbols, chartTimeframes } from "@cf-bench/dataset";
import { createChart } from "@cf-bench/chart-core";

declare global {
    interface Window {
        __CF_BENCH__?: any;
        __CF_BENCH_CONFIG__?: { chartCache?: string };
    }
}

function getChartFetchOptions(): RequestInit | undefined {
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

const defaultIndicators = { sma20: true, sma50: false, ema20: false, volume: true };

export function Chart() {
    const [symbol, setSymbol] = useState("BTC");
    const [timeframe, setTimeframe] = useState<(typeof chartTimeframes)[number]>("1h");
    const [indicators, setIndicators] = useState(defaultIndicators);
    const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
    const [chartReady, setChartReady] = useState(false);

    const [isPending, startTransition] = useTransition();

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

    // useMemo for static values
    const symbols = useMemo(() => chartSymbols, []);
    const timeframes = useMemo(() => chartTimeframes, []);

    // useMemo for chart options
    const chartOptions = useMemo(() => ({
        initialViewport: 180,
        onStats: (stats) => {
            window.__CF_BENCH__ = window.__CF_BENCH__ || {};
            window.__CF_BENCH__.chartCore = stats;
        },
    }), []);

    // useDeferredValue for expensive renders
    const deferredIndicators = useDeferredValue(indicators);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (!chartRef.current) {
            // Defer chart creation to next frame
            requestAnimationFrame(() => {
                const chart = createChart(canvas, chartOptions);
                chartRef.current = chart;

                requestAnimationFrame(() => {
                    chart.setIndicators(deferredIndicators);
                    chart.resize();
                    setChartReady(true);
                });
            });
        } else {
            // Update indicators with rAF for smooth updates
            requestAnimationFrame(() => {
                chartRef.current?.setIndicators(deferredIndicators);
            });
        }
    }, [deferredIndicators, chartOptions]);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            setStatus("loading");
            const points = timeframe === "1m" ? 900 : timeframe === "5m" ? 700 : timeframe === "15m" ? 520 : 360;

            window.__CF_BENCH__ = window.__CF_BENCH__ || {};
            window.__CF_BENCH__.chart = window.__CF_BENCH__.chart || {};
            window.__CF_BENCH__.chart.switchStartTs = performance.now();

            try {
                const data = await fetchCandles(symbol, timeframe, points);
                if (cancelled) return;

                const chart = chartRef.current;
                if (chart) {
                    // Use requestAnimationFrame for smooth updates
                    requestAnimationFrame(() => {
                        chart.setIndicators(deferredIndicators);
                        chart.setCandles(data.candles);
                    });
                }

                const end = performance.now();
                window.__CF_BENCH__.chart = {
                    ...window.__CF_BENCH__.chart,
                    ready: true,
                    symbol,
                    timeframe,
                    lastRenderTs: end,
                    switchDurationMs: end - (window.__CF_BENCH__.chart.switchStartTs ?? end),
                };

                setStatus("ready");
            } catch (e) {
                console.error(e);
                window.__CF_BENCH__ = window.__CF_BENCH__ || {};
                window.__CF_BENCH__.chart = {
                    ...window.__CF_BENCH__.chart,
                    ready: true,
                    error: true,
                    errorMessage: e instanceof Error ? e.message : String(e),
                };
                setStatus("error");
            }
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [symbol, timeframe]);

    // Handle symbol/timeframe changes with useTransition
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
        </>
    );
}
