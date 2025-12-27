<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { createChart } from "@cf-bench/chart-core";
  import { createChartStore } from "@cf-bench/chart-hooks/svelte";

  const chartStore = createChartStore();

  let canvas: HTMLCanvasElement;
  let chart: ReturnType<typeof createChart> | null = null;
  let chartReady = false;
  let rafId: number | null = null;
  let timeoutId: number | null = null;
  let error: string | null = null;

  // Debounce expensive chart updates
  function debouncedUpdate(fn: () => void) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn();
      timeoutId = null;
    }, 100);
  }

  onMount(async () => {
    try {
      console.log('[SvelteKit Chart] Mounting...');
      if (!canvas) {
        throw new Error('Canvas element not found');
      }

      // Defer chart creation to next frame
      rafId = requestAnimationFrame(() => {
        try {
          chart = createChart(canvas, {
            initialViewport: 180,
          });

          // Defer resize to next frame
          requestAnimationFrame(() => {
            try {
              chart?.resize();
              chart?.setIndicators($chartStore.indicators);
              // Set initial data after chart is created
              if ($chartStore.data) {
                chart?.setCandles($chartStore.data.candles);
              }
              chartReady = true;
              console.log('[SvelteKit Chart] Ready');
            } catch (err) {
              console.error('[SvelteKit Chart] Error during chart setup:', err);
              error = err instanceof Error ? err.message : 'Chart setup failed';
            }
          });
        } catch (err) {
          console.error('[SvelteKit Chart] Error creating chart:', err);
          error = err instanceof Error ? err.message : 'Chart creation failed';
        }
      });
    } catch (err) {
      console.error('[SvelteKit Chart] Mount error:', err);
      error = err instanceof Error ? err.message : 'Chart failed to load';
    }
  });

  onDestroy(() => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    chartStore.destroy();
    chart?.destroy?.();
  });

  // Update candles when data changes (with rAF)
  $: if ($chartStore.data && chart && chartReady) {
    debouncedUpdate(() => {
      requestAnimationFrame(() => {
        chart?.setIndicators($chartStore.indicators);
        chart?.setCandles($chartStore.data.candles);
      });
    });
  }

  // Update indicators when changed (with rAF)
  $: if (chart && chartReady) {
    debouncedUpdate(() => {
      requestAnimationFrame(() => {
        chart?.setIndicators($chartStore.indicators);
      });
    });
  }

  function handleSymbolChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    chartStore.setSymbol(target.value);
  }

  function handleTimeframeChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    chartStore.setTimeframe(target.value as any);
  }

  function handleIndicatorChange(key: keyof typeof $chartStore.indicators, e: Event) {
    const target = e.target as HTMLInputElement;
    chartStore.setIndicators((prev) => ({ ...prev, [key]: target.checked }));
  }
</script>

<h1 class="h1">Chart (SPA-like)</h1>

{#if error}
  <div class="card" style="padding: 14px; border: 1px solid red; background: #fee;">
    <h2 style="color: red; margin: 0 0 8px 0;">Chart Error</h2>
    <p style="margin: 0;">{error}</p>
  </div>
{/if}

<div class="card" style="padding: 14px">
  <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
    <div class="pill">
      <span class="muted small">Symbol</span>
      <select
        data-testid="symbol-select"
        class="input"
        style="width: 140px"
        value={$chartStore.symbol}
        on:change={handleSymbolChange}
      >
        {#each $chartStore.symbols as s}
          <option value={s}>{s}</option>
        {/each}
      </select>
    </div>

    <div class="pill">
      <span class="muted small">Timeframe</span>
      <select
        data-testid="timeframe-select"
        class="input"
        style="width: 120px"
        value={$chartStore.timeframe}
        on:change={handleTimeframeChange}
      >
        {#each $chartStore.timeframes as tf}
          <option value={tf}>{tf}</option>
        {/each}
      </select>
    </div>

    <div style="display: flex; align-items: center; gap: 10px">
      <label class="muted small" style="display: flex; gap: 6px; align-items: center">
        <input
          type="checkbox"
          checked={$chartStore.indicators.sma20}
          on:change={(e) => handleIndicatorChange("sma20", e)}
        />
        SMA20
      </label>
      <label class="muted small" style="display: flex; gap: 6px; align-items: center">
        <input
          type="checkbox"
          checked={$chartStore.indicators.sma50}
          on:change={(e) => handleIndicatorChange("sma50", e)}
        />
        SMA50
      </label>
      <label class="muted small" style="display: flex; gap: 6px; align-items: center">
        <input
          type="checkbox"
          checked={$chartStore.indicators.ema20}
          on:change={(e) => handleIndicatorChange("ema20", e)}
        />
        EMA20
      </label>
      <label class="muted small" style="display: flex; gap: 6px; align-items: center">
        <input
          type="checkbox"
          checked={$chartStore.indicators.volume}
          on:change={(e) => handleIndicatorChange("volume", e)}
        />
        Volume
      </label>
    </div>

    <div class="muted small">
      {$chartStore.status === "loading" ? "Loading…" : $chartStore.status === "error" ? "Error" : "Ready"}
    </div>
  </div>

  <div class="muted small" style="margin-top: 10px">
    Pan: drag • Zoom: mousewheel/trackpad • Crosshair: move cursor
  </div>

  <div style="height: 420px; margin-top: 12px; position: relative">
    {#if !chartReady}
      <div data-testid="chart-loading" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: var(--bg); border-radius: 12px; border: 1px solid var(--border);">
        <span class="muted">Loading chart…</span>
      </div>
    {:else}
      <div data-testid="chart-ready" style="position: absolute; inset: 0; pointer-events: none;"></div>
    {/if}
    <canvas
      bind:this={canvas}
      data-testid="chart-canvas"
      style="width: 100%; height: 100%; border-radius: 12px; border: 1px solid var(--border); opacity: {chartReady ? 1 : 0}; transition: opacity 0.2s ease-in-out;"
    />
  </div>
</div>
