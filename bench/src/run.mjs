import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);

const DEFAULT_CONFIG = new URL('../bench.config.json', import.meta.url);
const DEFAULT_OUT = new URL('../results.v2.json', import.meta.url);

/**
 * Timing constants for benchmark measurements.
 * These values balance accuracy vs. test execution speed.
 */
const TIMING = {
  /** Time between chart ready checks (poll interval) */
  CHART_READY_POLL_MS: 100,
  /** Time after mouse/wheel interactions to allow UI to settle */
  INTERACTION_SETTLE_MS: 150,
  /** Time after control changes (dropdowns, checkboxes) to reflect state */
  CONTROL_CHANGE_MS: 250,
  /** Time after warmup route hit before moving to next route */
  WARMUP_SETTLE_MS: 500,
  /** Required quiet window after last LCP update before sampling metrics */
  LCP_STABLE_WINDOW_MS: 1000,
  /** Max time to wait for LCP to stabilize */
  LCP_MAX_WAIT_MS: 5000,
  /** Max time to wait for hydration markers (if present) */
  HYDRATION_MAX_WAIT_MS: 2000,
  /** Extra settle time after LCP stability to capture long tasks */
  POST_LOAD_SETTLE_MS: 500,
  /** Max time to wait for client-nav selector or URL */
  CLIENT_NAV_TIMEOUT_MS: 12000,
  /** Max time to wait for scenario readiness selectors */
  SCENARIO_WAIT_TIMEOUT_MS: 12000,
  /** Hard cap for an entire scenario (guard against hung navigations) */
  SCENARIO_HARD_TIMEOUT_MS: 60000,
  /** Max time to wait for CDP metrics collection */
  CDP_TIMEOUT_MS: 5000,
  /** Max time to wait for INP to be recorded after interactions */
  INP_SETTLE_MS: 1500,
};

const NAV_RETRY = {
  maxAttempts: 3,
  backoffMs: 750,
};

const NETWORK_PROFILES = {
  none: {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
    connectionType: 'none',
  },
  'fast-4g': {
    offline: false,
    latency: 150,
    downloadThroughput: Math.floor((1.6 * 1024 * 1024) / 8),
    uploadThroughput: Math.floor((0.75 * 1024 * 1024) / 8),
    connectionType: 'cellular4g',
  },
  'slow-3g': {
    offline: false,
    latency: 400,
    downloadThroughput: Math.floor((0.4 * 1024 * 1024) / 8),
    uploadThroughput: Math.floor((0.4 * 1024 * 1024) / 8),
    connectionType: 'cellular3g',
  },
};

const VIEWPORT = { width: 1280, height: 720 };
const BENCH_PROFILE_HEADER = 'x-cf-bench-profile';

function arg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function flag(name) {
  return process.argv.includes(name);
}

function mean(a) {
  if (!a.length) return null;
  return a.reduce((s, x) => s + x, 0) / a.length;
}

function stdev(a) {
  if (a.length < 2) return null;
  const m = mean(a);
  const v = a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1);
  return Math.sqrt(v);
}

function percentile(a, p) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo];
  const t = idx - lo;
  return s[lo] * (1 - t) + s[hi] * t;
}

function summarize(a) {
  const arr = a.filter((x) => Number.isFinite(x));
  if (!arr.length) return { n: 0 };
  return {
    n: arr.length,
    min: Math.min(...arr),
    max: Math.max(...arr),
    mean: mean(arr),
    stdev: stdev(arr),
    p50: percentile(arr, 50),
    p75: percentile(arr, 75),
    p90: percentile(arr, 90),
    p95: percentile(arr, 95),
    p99: percentile(arr, 99),
  };
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDuration(ms, digits = 1) {
  if (!Number.isFinite(ms)) return '—';
  if (ms < 1) return `${(ms * 1000).toFixed(0)}us`;
  return `${ms.toFixed(digits)}ms`;
}

function safeExec(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function getGitInfo() {
  const commit = safeExec('git rev-parse HEAD');
  if (!commit) return null;
  const branch = safeExec('git rev-parse --abbrev-ref HEAD');
  const describe = safeExec('git describe --tags --always --dirty');
  const dirty = Boolean(safeExec('git status --porcelain'));
  return { commit, branch, describe, dirty };
}

async function readJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function collectFrameworkPackages(frameworks) {
  const out = {};
  for (const fw of frameworks) {
    const pkgPath = path.join(process.cwd(), 'apps', fw.name, 'package.json');
    const pkg = await readJsonFile(pkgPath);
    out[fw.name] = pkg
      ? {
          path: path.relative(process.cwd(), pkgPath),
          name: pkg.name ?? null,
          version: pkg.version ?? null,
          dependencies: pkg.dependencies ?? {},
          devDependencies: pkg.devDependencies ?? {},
        }
      : null;
  }
  return out;
}

async function collectDatasetInfo() {
  const pkgPath = path.join(process.cwd(), 'packages', 'dataset', 'package.json');
  const pkg = await readJsonFile(pkgPath);
  if (!pkg) return null;
  return {
    path: path.relative(process.cwd(), pkgPath),
    name: pkg.name ?? null,
    version: pkg.version ?? null,
  };
}

function normalizeThrottling(value, profiles) {
  if (!value) return null;
  if (typeof value === 'string') {
    return profiles?.[value] || NETWORK_PROFILES[value] || null;
  }
  if (typeof value === 'object') return value;
  return null;
}

function resolveThrottling(config, profileSettings, profile, cliThrottle) {
  const profiles = config.throttlingProfiles || {};
  const fromCli = normalizeThrottling(cliThrottle, profiles);
  if (fromCli) return fromCli;
  const fromProfile = normalizeThrottling(profileSettings?.[profile]?.throttling, profiles);
  if (fromProfile) return fromProfile;
  return normalizeThrottling(config.throttling, profiles);
}

function timeoutScaleFor(throttling) {
  if (!throttling) return 1;
  if (typeof throttling.timeoutScale === 'number' && throttling.timeoutScale > 0) return throttling.timeoutScale;
  const cpu = throttling.cpu ?? 1;
  const network = throttling.network ?? 'none';
  const networkScale = network && network !== 'none' ? 2 : 1;
  const cpuScale = cpu > 1 ? Math.min(3, cpu) : 1;
  return Math.max(networkScale, cpuScale);
}

function benchHeadersForProfile(profile) {
  if (!profile) return {};
  return { [BENCH_PROFILE_HEADER]: profile };
}

async function applyThrottling(page, throttling) {
  if (!throttling) return null;
  const cpu = Number.isFinite(throttling.cpu) ? throttling.cpu : 1;
  const networkProfile = throttling.network ? throttling.network : 'none';
  const network = NETWORK_PROFILES[networkProfile] || NETWORK_PROFILES.none;
  try {
    const client = await page.context().newCDPSession(page);
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: network.offline,
      latency: network.latency,
      downloadThroughput: network.downloadThroughput,
      uploadThroughput: network.uploadThroughput,
      connectionType: network.connectionType,
    });
    await client.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    return { cpu, network: networkProfile };
  } catch {
    return { cpu, network: networkProfile, error: 'cdp_throttle_failed' };
  }
}

const FRAMEWORK_VERSION_KEYS = {
  'react-vite': ['react', 'react-dom', 'vite'],
  'react-spa': ['react', 'react-dom', 'react-router-dom', 'vite'],
  astro: ['astro'],
  nextjs: ['next', 'react', 'react-dom'],
  'tanstack-start': ['@tanstack/react-start', '@tanstack/react-router', 'react', 'react-dom', 'vinxi', 'vite'],
  sveltekit: ['@sveltejs/kit', 'svelte', '@sveltejs/adapter-cloudflare', 'vite'],
  qwik: ['@qwik.dev/core', '@qwik.dev/router', 'vite'],
  solid: ['solid-js', 'vite'],
};

function pickFrameworkVersions(frameworkPackages) {
  const out = {};
  for (const [name, pkg] of Object.entries(frameworkPackages)) {
    if (!pkg) {
      out[name] = null;
      continue;
    }
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const keys = FRAMEWORK_VERSION_KEYS[name] || [];
    const picked = {};
    for (const key of keys) {
      if (deps[key]) picked[key] = deps[key];
    }
    out[name] = picked;
  }
  return out;
}

function extractColo(cfRay) {
  if (!cfRay) return null;
  const idx = cfRay.lastIndexOf('-');
  if (idx === -1 || idx === cfRay.length - 1) return null;
  return cfRay.slice(idx + 1);
}

function summarizeHeaderValues(rows, key) {
  const counts = {};
  for (const row of rows) {
    const value = row?.headers?.[key];
    if (!value) continue;
    counts[value] = (counts[value] || 0) + 1;
  }
  return counts;
}

function summarizeEdgeLocations(rows) {
  const byColo = {};
  for (const row of rows) {
    const colo = extractColo(row?.headers?.['cf-ray']);
    if (!colo) continue;
    byColo[colo] = (byColo[colo] || 0) + 1;
  }
  const distinct = Object.keys(byColo).sort();
  const total = distinct.reduce((sum, colo) => sum + byColo[colo], 0);
  return { byColo, distinct, total };
}

function summarizeServerTiming(rows) {
  const byName = new Map();
  for (const row of rows) {
    const entries = row?.headers?.serverTiming;
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const name = entry?.name;
      if (!name) continue;
      const bucket = byName.get(name) || { count: 0, durations: [] };
      bucket.count += 1;
      if (Number.isFinite(entry.dur)) bucket.durations.push(entry.dur);
      byName.set(name, bucket);
    }
  }
  const out = {};
  for (const [name, data] of byName.entries()) {
    out[name] = {
      count: data.count,
      durMs: summarize(data.durations),
    };
  }
  return out;
}

async function getBrowserEnv(browser) {
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();
  try {
    await page.goto('about:blank');
    return await page.evaluate(() => ({
      language: navigator.language,
      languages: navigator.languages,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory,
      userAgent: navigator.userAgent,
    }));
  } catch {
    return null;
  } finally {
    await ctx.close();
  }
}

function toMs(seconds) {
  if (!Number.isFinite(seconds)) return null;
  return seconds * 1000;
}

function parseServerTiming(value) {
  if (!value) return null;
  const entries = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!entries.length) return null;

  return entries.map((entry) => {
    const parts = entry.split(';').map((part) => part.trim()).filter(Boolean);
    const name = parts.shift();
    const data = { name };
    for (const part of parts) {
      const [key, rawValue] = part.split('=');
      if (!key) continue;
      if (rawValue === undefined) {
        data[key] = true;
        continue;
      }
      const cleaned = rawValue.replace(/^"|"$/g, '');
      const numeric = Number(cleaned);
      data[key] = Number.isFinite(numeric) ? numeric : cleaned;
    }
    return data;
  });
}

const DEFAULT_SCENARIOS = [
  { name: 'home', path: '/', type: 'ssr' },
  { name: 'stays', path: '/stays', type: 'ssr', waitFor: '[data-testid="stay-card"]' },
  {
    name: 'blog',
    path: '/blog',
    type: 'ssg',
    waitFor: '[data-testid="blog-post-card"]',
    waitUntil: 'domcontentloaded',
    reload: false,
  },
  { name: 'chart', path: '/chart', interact: true, type: 'spa' },
  {
    name: 'spa_nav',
    type: 'client-nav',
    requiresFeature: 'clientNav',
    clientNav: {
      from: '/',
      to: '/stays',
      click: 'a[href="/stays"]',
      waitFor: '[data-testid="stay-card"]',
    },
  },
  {
    name: 'spa_nav_dynamic',
    type: 'client-nav',
    requiresFeature: 'clientNav',
    clientNav: {
      from: '/stays',
      waitForFrom: '[data-testid="stay-card"]',
      click: '[data-testid="stay-card"]',
      toPattern: '/stays/\\d+$',
      waitFor: '[data-testid="stay-description"]',
    },
  },
];

function normalizeFrameworks(frameworks) {
  if (Array.isArray(frameworks)) return frameworks;
  if (!frameworks) return [];
  return Object.entries(frameworks).map(([name, value]) => {
    if (typeof value === 'string') return { name, url: value };
    return { name, ...value };
  });
}

async function loadWebVitalsScript() {
  // Prefer IIFE bundles for browser injection; fall back to UMD if needed.
  const distDir = path.dirname(require.resolve('web-vitals'));
  const candidates = [
    path.join(distDir, 'web-vitals.iife.js'),
    path.join(distDir, 'web-vitals.iife.min.js'),
    path.join(distDir, 'web-vitals.umd.cjs'),
  ];
  for (const p of candidates) {
    try {
      return await fs.readFile(p, 'utf8');
    } catch {
      // continue
    }
  }

  const legacyCandidates = [
    'web-vitals/dist/web-vitals.iife.js',
    'web-vitals/dist/web-vitals.iife.min.js',
    'web-vitals/dist/web-vitals.umd.cjs',
  ];
  for (const c of legacyCandidates) {
    try {
      const p = require.resolve(c);
      return await fs.readFile(p, 'utf8');
    } catch {
      // continue
    }
  }

  throw new Error('Could not resolve a web-vitals bundle from node_modules');
}

function buildInitScript(webVitalsSrc, benchConfig = {}) {
  // This runs before any page script. It installs CWV observers, longtask capture, and a getter.
  const configJson = JSON.stringify(benchConfig);
  return `${webVitalsSrc}
;(function(){
  globalThis.__CF_BENCH_CONFIG__ = ${configJson};
  const root = (globalThis.__BENCH__ = globalThis.__BENCH__ || { cwv: {}, longtasks: [], marks: {}, resources: {}, errors: [] });
  const now = () => (performance && performance.now ? performance.now() : Date.now());

  // CWV via web-vitals global
  try {
    const wv =
      globalThis.webVitals ||
      globalThis.webvitals ||
      globalThis.WebVitals ||
      (typeof webVitals !== 'undefined' ? webVitals : undefined);
    if (!globalThis.webVitals && typeof webVitals !== 'undefined') {
      globalThis.webVitals = webVitals;
    }
    if (wv && typeof wv.onLCP === 'function') {
      wv.onLCP((m)=>{ root.cwv.lcp = { value: m.value, rating: m.rating, id: m.id, delta: m.delta, navType: m.navigationType }; root.cwv.lcpLastTs = now(); }, { reportAllChanges: true });
      wv.onCLS((m)=>{ root.cwv.cls = { value: m.value, rating: m.rating, id: m.id, delta: m.delta, navType: m.navigationType }; }, { reportAllChanges: true });
      wv.onINP((m)=>{ root.cwv.inp = { value: m.value, rating: m.rating, id: m.id, delta: m.delta, navType: m.navigationType }; }, { reportAllChanges: true });
      wv.onFCP((m)=>{ root.cwv.fcp = { value: m.value, rating: m.rating, id: m.id, delta: m.delta, navType: m.navigationType }; }, { reportAllChanges: true });
      wv.onTTFB((m)=>{ root.cwv.ttfb = { value: m.value, rating: m.rating, id: m.id, delta: m.delta, navType: m.navigationType }; }, { reportAllChanges: true });
    }
  } catch (e) {
    root.errors.push('web-vitals init failed: ' + (e && e.message ? e.message : String(e)));
  }

  // Long tasks (TBT proxy)
  try {
    const obs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        root.longtasks.push({ startTime: entry.startTime, duration: entry.duration });
      }
    });
    obs.observe({ type: 'longtask', buffered: true });
  } catch (e) {
    // ignore
  }

  globalThis.addEventListener?.('error', (e) => { try { root.errors.push(String(e && e.message ? e.message : e)); } catch {} });
  globalThis.addEventListener?.('unhandledrejection', (e) => { try { root.errors.push(String(e && e.reason ? e.reason : e)); } catch {} });

  globalThis.__BENCH_GET__ = () => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = performance.getEntriesByType('paint') || [];
    let fcp = root.cwv?.fcp?.value ?? null;
    for (const p of paints) { if (p.name === 'first-contentful-paint') fcp = p.startTime; }

    const hasFcp = Number.isFinite(fcp);
    const start = hasFcp ? fcp : null;
    const end = hasFcp ? fcp + 5000 : null;
    let tbt = null;
    let count = 0;
    let worst = 0;
    const allLongTasks = root.longtasks || [];
    if (hasFcp) {
      tbt = 0;
      for (const lt of allLongTasks) {
        if (lt.startTime < start || lt.startTime > end) continue;
        const block = Math.max(0, lt.duration - 50);
        if (block > 0) { tbt += block; count++; worst = Math.max(worst, lt.duration); }
      }
    }

    const resources = performance.getEntriesByType('resource') || [];
    const byType = { js: 0, css: 0, img: 0, font: 0, other: 0, total: 0, count: resources.length };
    for (const r of resources) {
      const t = r.transferSize || 0;
      byType.total += t;
      const name = r.name || '';
      if (name.endsWith('.js') || name.includes('.js?')) byType.js += t;
      else if (name.endsWith('.css') || name.includes('.css?')) byType.css += t;
      else if (/\\.(png|jpg|jpeg|webp|gif|svg)(\\?|$)/i.test(name)) byType.img += t;
      else if (/\\.(woff2|woff|ttf|otf)(\\?|$)/i.test(name)) byType.font += t;
      else byType.other += t;
    }

    return {
      href: location.href,
      nav: nav ? {
        type: nav.type,
        duration: nav.duration,
        ttfb: nav.responseStart,
        domInteractive: nav.domInteractive,
        domContentLoaded: nav.domContentLoadedEventEnd,
        loadEventEnd: nav.loadEventEnd,
        transferSize: nav.transferSize,
        encodedBodySize: nav.encodedBodySize,
        decodedBodySize: nav.decodedBodySize,
      } : null,
      cwv: root.cwv || {},
      longTasks: {
        fcp: start,
        windowEnd: end,
        tbt,
        count,
        totalCount: allLongTasks.length,
        hasFcp,
        worstLongTask: worst,
      },
      resources: byType,
      errors: root.errors || [],
      app: globalThis.__CF_BENCH__ || (typeof window !== 'undefined' ? window.__CF_BENCH__ : null) || null
    };
  };
})();`;
}

async function startCdpMetrics(page) {
  try {
    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');
    const baseline = await client.send('Performance.getMetrics');
    return { client, baseline };
  } catch {
    return null;
  }
}

async function endCdpMetrics(cdp) {
  if (!cdp?.client?.detach) return;
  try {
    await cdp.client.detach();
  } catch {
    // ignore
  }
}

async function cdpMemory(page, cdp = null) {
  try {
    const client = cdp?.client ?? (await page.context().newCDPSession(page));
    if (!cdp?.client) {
      await client.send('Performance.enable');
    }
    const m = await client.send('Performance.getMetrics');
    const pick = (blob, name) => blob?.metrics?.find((x) => x.name === name)?.value;
    const diff = (name) => {
      const current = pick(m, name);
      const base = pick(cdp?.baseline, name);
      if (Number.isFinite(current) && Number.isFinite(base)) return current - base;
      return Number.isFinite(current) ? current : null;
    };
    return {
      JSHeapUsedSize: pick(m, 'JSHeapUsedSize'),
      JSHeapTotalSize: pick(m, 'JSHeapTotalSize'),
      ScriptDuration: diff('ScriptDuration'),
      TaskDuration: diff('TaskDuration'),
      LayoutDuration: diff('LayoutDuration'),
      RecalcStyleDuration: diff('RecalcStyleDuration'),
    };
  } catch {
    return null;
  }
}

async function waitForChartReady(page, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ready = await page.evaluate(() => !!globalThis.__CF_BENCH__?.chart?.ready);
    if (ready) return true;
    await page.waitForTimeout(TIMING.CHART_READY_POLL_MS);
  }
  return false;
}

async function waitForLcpSettled(page, maxWaitMs = TIMING.LCP_MAX_WAIT_MS, stableWindowMs = TIMING.LCP_STABLE_WINDOW_MS) {
  const start = Date.now();
  let stableChecks = 0;
  const minStableChecks = 2; // Require consecutive stable readings to reduce flakiness
  while (Date.now() - start < maxWaitMs) {
    const state = await page.evaluate(() => {
      const root = globalThis.__BENCH__;
      const lcp = root?.cwv?.lcp?.value ?? null;
      const lastTs = root?.cwv?.lcpLastTs ?? null;
      const now = performance.now();
      return { lcp, lastTs, now };
    });
    if (state.lcp == null || state.lastTs == null) {
      await page.waitForTimeout(100);
      continue;
    }
    // Check if LCP has been stable for the required window
    if (state.now - state.lastTs >= stableWindowMs) {
      stableChecks++;
      if (stableChecks >= minStableChecks) {
        return true;
      }
    } else {
      // Reset counter if LCP updated
      stableChecks = 0;
    }
    await page.waitForTimeout(100);
  }
  return false;
}

async function waitForHydration(page, timeoutMs = TIMING.HYDRATION_MAX_WAIT_MS) {
  const start = Date.now();
  const missingGraceMs = 250;
  while (Date.now() - start < timeoutMs) {
    const state = await page.evaluate(() => {
      const h = globalThis.__CF_BENCH__?.hydration;
      if (!h) return { status: 'missing' };
      return { status: 'present', startMs: h.startMs, endMs: h.endMs };
    });
    if (
      state?.status === 'present' &&
      Number.isFinite(state.startMs) &&
      Number.isFinite(state.endMs)
    ) {
      return true;
    }
    if (state?.status === 'missing' && Date.now() - start > missingGraceMs) {
      return false;
    }
    await page.waitForTimeout(50);
  }
  return false;
}

async function waitForInp(page, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hasInp = await page.evaluate(() => Number.isFinite(globalThis.__BENCH__?.cwv?.inp?.value));
    if (hasInp) return true;
    await page.waitForTimeout(100);
  }
  return false;
}

async function chartInteractions(page, timeoutScale = 1) {
  const waitMs = 8000 * timeoutScale;
  // Basic interaction set to trigger INP-ish metrics and chart redraw.
  await page.waitForSelector('[data-testid="chart-canvas"]', { timeout: waitMs });
  if (!(await waitForChartReady(page, waitMs))) {
    throw new Error('chart_not_ready');
  }

  // Hover + drag
  const box = await page.locator('[data-testid="chart-canvas"]').boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.4, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(TIMING.INTERACTION_SETTLE_MS * timeoutScale);
    // Zoom
    await page.mouse.wheel(0, -450);
    await page.waitForTimeout(TIMING.INTERACTION_SETTLE_MS * timeoutScale);
  }

  // Toggle indicator and switch timeframe if present
  const tf = page.locator('[data-testid="timeframe-select"]');
  if (await tf.count()) {
    await tf.selectOption('15m');
    await page.waitForTimeout(TIMING.CONTROL_CHANGE_MS * timeoutScale);
  }
  // Click checkbox (first one)
  const cb = page.locator('input[type="checkbox"]').first();
  if (await cb.count()) {
    await cb.click();
    await page.waitForTimeout(TIMING.CONTROL_CHANGE_MS * timeoutScale);
  }

  // Switch symbol to produce data swap
  const sym = page.locator('[data-testid="symbol-select"]');
  if (await sym.count()) {
    await sym.selectOption('ETH');
    if (!(await waitForChartReady(page, waitMs))) {
      throw new Error('chart_not_ready');
    }
    await page.waitForTimeout(TIMING.CONTROL_CHANGE_MS * timeoutScale);
  }
}

async function collect(page, options = {}) {
  const { skipLcp = false, suppressCwv = false, suppressNav = false, timeoutScale = 1, cdp = null } = options;
  // Let LCP stabilize and long tasks collect
  if (!skipLcp) {
    await waitForLcpSettled(page, TIMING.LCP_MAX_WAIT_MS * timeoutScale, TIMING.LCP_STABLE_WINDOW_MS);
  }
  await waitForHydration(page, TIMING.HYDRATION_MAX_WAIT_MS * timeoutScale);
  await page.waitForTimeout(TIMING.POST_LOAD_SETTLE_MS * timeoutScale);
  const synthetic = await page.evaluate(() => globalThis.__BENCH_GET__?.());
  if (synthetic) {
    if (suppressCwv) synthetic.cwv = {};
    if (suppressNav) synthetic.nav = null;
  }
  let memory = null;
  try {
    memory = await withTimeout(cdpMemory(page, cdp), TIMING.CDP_TIMEOUT_MS * timeoutScale, 'cdp');
  } catch {
    memory = null;
  }
  const clientMetrics = memory
    ? {
        source: 'cdp:Performance.getMetrics',
        jsHeapUsedSize: memory.JSHeapUsedSize ?? null,
        jsHeapTotalSize: memory.JSHeapTotalSize ?? null,
        taskDurationMs: toMs(memory.TaskDuration),
        scriptDurationMs: toMs(memory.ScriptDuration),
        layoutDurationMs: toMs(memory.LayoutDuration),
        recalcStyleDurationMs: toMs(memory.RecalcStyleDuration),
      }
    : null;
  return { synthetic, memory, clientMetrics };
}

function errorToString(err) {
  if (!err) return 'unknown_error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || err.name;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function isRetryableNavError(err) {
  const msg = errorToString(err).toLowerCase();
  if (/^http_(408|429|5\\d\\d)$/.test(msg)) return true;
  if (msg.includes('timeout')) return true;
  if (msg.includes('net::err') || msg.includes('err_aborted') || msg.includes('frame was detached')) return true;
  return false;
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId = null;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(`${label}_timeout`);
      err.code = 'timeout';
      reject(err);
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

async function navigateWithRetry(page, options) {
  const { action, url, waitUntil, timeout } = options;
  let currentWaitUntil = waitUntil;
  let lastErr = null;
  for (let attempt = 1; attempt <= NAV_RETRY.maxAttempts; attempt++) {
    try {
      const res =
        action === 'reload'
          ? await page.reload({ waitUntil: currentWaitUntil, timeout })
          : await page.goto(url, { waitUntil: currentWaitUntil, timeout });
      const status = res ? res.status() : null;
      if (status && status >= 400) {
        const err = new Error(`http_${status}`);
        err.status = status;
        throw err;
      }
      return { res, status, attempts: attempt };
    } catch (err) {
      lastErr = err;
      if (attempt < NAV_RETRY.maxAttempts && isRetryableNavError(err)) {
        if (currentWaitUntil === 'load' && errorToString(err).toLowerCase().includes('timeout')) {
          currentWaitUntil = 'domcontentloaded';
        }
        const backoff = NAV_RETRY.backoffMs * attempt;
        await page.waitForTimeout(backoff);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function fetchBenchApi(browser, fw) {
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  try {
    const res = await ctx.request.get(`${fw.url}/api/bench`, { timeout: 8000 });
    const headers = res.headers();
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return {
      ok: res.ok(),
      status: res.status(),
      data,
      headers: {
        'server-timing': headers['server-timing'],
        serverTiming: parseServerTiming(headers['server-timing']),
        'cf-cache-status': headers['cf-cache-status'],
        'cf-ray': headers['cf-ray'],
        'cache-control': headers['cache-control'],
        date: headers['date'],
      },
    };
  } catch (err) {
    return { ok: false, error: errorToString(err) };
  } finally {
    await ctx.close();
  }
}

function scenarioUrl(fw, sc) {
  if (sc.path) return fw.url + sc.path;
  if (sc.clientNav?.to) return fw.url + sc.clientNav.to;
  if (sc.clientNav?.from) return fw.url + sc.clientNav.from;
  return fw.url;
}

async function runScenario(page, fw, sc, iteration, phase, bundleSizes, profile, throttling, timeoutScale, throttleApplied) {
  const frameworkMeta = {
    delivery: fw.delivery ?? null,
    rendering: fw.rendering ?? null,
    features: fw.features ?? null,
  };
  const base = {
    framework: fw.name,
    frameworkMeta,
    iteration: iteration + 1,
    profile,
    phase,
    scenario: sc.name,
    scenarioType: sc.type,
    url: scenarioUrl(fw, sc),
    isCold: phase === 'cold' && iteration === 0 && sc.name === 'home',
    throttling: throttling
      ? {
          cpu: throttling.cpu ?? null,
          network: throttling.network ?? null,
          timeoutScale,
        }
      : null,
    throttleApplied: throttleApplied || null,
  };
  const navTimeout = TIMING.CLIENT_NAV_TIMEOUT_MS * timeoutScale;
  const scenarioTimeout = TIMING.SCENARIO_WAIT_TIMEOUT_MS * timeoutScale;
  const hardTimeout = TIMING.SCENARIO_HARD_TIMEOUT_MS * timeoutScale;
  let status = null;
  let navAttempts = 0;
  let cdp = null;

  if (sc.requiresFeature && !fw.features?.[sc.requiresFeature]) {
    return { ...base, ok: false, skipped: true, error: `missing_feature:${sc.requiresFeature}` };
  }

  const run = async () => {
    try {
      cdp = await startCdpMetrics(page);
    if (sc.type === 'client-nav') {
      const nav = sc.clientNav || {};
      const fromUrl = fw.url + (nav.from || '/');
      const waitUntil = nav.waitUntil || 'load';
      const navResult = await navigateWithRetry(page, {
        action: 'goto',
        url: fromUrl,
        waitUntil,
        timeout: scenarioTimeout,
      });
      if (!navResult) {
        throw new Error('navigateWithRetry returned undefined for client-nav from URL');
      }
      const res = navResult.res;
      status = navResult.status ?? null;
      navAttempts = navResult.attempts ?? 0;
        if (nav.waitForFrom) await page.waitForSelector(nav.waitForFrom, { timeout: navTimeout });
        const start = Date.now();
        if (nav.click) await page.click(nav.click);
        const toPattern =
          nav.toPattern instanceof RegExp
            ? nav.toPattern
            : typeof nav.toPattern === 'string' && nav.toPattern.length
              ? new RegExp(nav.toPattern)
              : null;
        if (toPattern) {
          await page.waitForURL(toPattern, { timeout: navTimeout });
        } else if (nav.to) {
          await page.waitForURL(new RegExp(`${nav.to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), {
            timeout: navTimeout,
          });
        }
        if (nav.waitFor) await page.waitForSelector(nav.waitFor, { timeout: navTimeout });
        const end = Date.now();
        await waitForInp(page, TIMING.INP_SETTLE_MS * timeoutScale);
        const data = await collect(page, { skipLcp: true, suppressNav: true, timeoutScale, cdp });
        const headers = res ? res.headers() : {};
        const serverTiming = parseServerTiming(headers['server-timing']);
        const serverMetrics = {
          ttfb: data.synthetic?.nav?.ttfb ?? null,
          serverTiming,
        };
        return {
          ...base,
          ok: true,
          status,
          navAttempts,
          clientNavMs: end - start,
          headers: {
            'server-timing': headers['server-timing'],
            serverTiming,
            'cf-cache-status': headers['cf-cache-status'],
            'cf-ray': headers['cf-ray'],
            'cache-control': headers['cache-control'],
            age: headers['age'],
            date: headers['date'],
          },
          serverMetrics,
          ...data,
        };
      }

      const waitUntil = sc.waitUntil || 'load';
      const action = phase === 'warm' && sc.reload !== false ? 'reload' : 'goto';
      const navResult = await navigateWithRetry(page, {
        action,
        url: fw.url + sc.path,
        waitUntil,
        timeout: scenarioTimeout,
      });
      const res = navResult.res;
      status = navResult.status ?? null;
      navAttempts = navResult.attempts ?? 0;
      if (sc.waitFor) await page.waitForSelector(sc.waitFor, { timeout: scenarioTimeout });
      if (sc.interact) {
        await chartInteractions(page, timeoutScale);
        await waitForInp(page, TIMING.INP_SETTLE_MS * timeoutScale);
      }
      const data = await collect(page, { timeoutScale, cdp });
      if (sc.name === 'chart' && data.synthetic?.app?.chart?.error) {
        const message = data.synthetic?.app?.chart?.errorMessage || 'chart_error';
        throw new Error(`chart_error:${message}`);
      }
      const headers = res ? res.headers() : {};
      const serverTiming = parseServerTiming(headers['server-timing']);
      const serverMetrics = {
        ttfb: data.synthetic?.nav?.ttfb ?? null,
        serverTiming,
      };

      if (
        phase === 'cold' &&
        iteration === 0 &&
        data.synthetic?.resources &&
        bundleSizes &&
        !bundleSizes[fw.name].measured &&
        sc.name === 'chart'
      ) {
        bundleSizes[fw.name].js += data.synthetic.resources.js || 0;
        bundleSizes[fw.name].css += data.synthetic.resources.css || 0;
        bundleSizes[fw.name].total += data.synthetic.resources.total || 0;
        bundleSizes[fw.name].measured = true;
      }

      return {
        ...base,
        ok: true,
        status,
        navAttempts,
        headers: {
          'server-timing': headers['server-timing'],
          serverTiming,
          'cf-cache-status': headers['cf-cache-status'],
          'cf-ray': headers['cf-ray'],
          'cache-control': headers['cache-control'],
          age: headers['age'],
          date: headers['date'],
        },
        serverMetrics,
        ...data,
      };
    } catch (err) {
      const errStatus = typeof err?.status === 'number' ? err.status : status;
      return { ...base, ok: false, status: errStatus ?? null, navAttempts, error: errorToString(err) };
    } finally {
      await endCdpMetrics(cdp);
    }
  };

  try {
    return await withTimeout(run(), hardTimeout, 'scenario');
  } catch (err) {
    return { ...base, ok: false, status: status ?? null, navAttempts, error: errorToString(err) };
  }
}

async function warmupFramework(browser, fw, initScript, scenarios, throttling, timeoutScale, benchHeaders) {
  console.log(`  ⏳ Warming up ${fw.name}...`);
  const ctx = await browser.newContext({ viewport: VIEWPORT, extraHTTPHeaders: benchHeaders || undefined });
  await ctx.addInitScript({ content: initScript });
  const page = await ctx.newPage();
  if (throttling) {
    await applyThrottling(page, throttling);
  }

  try {
    // Hit all routes once to warm up isolates
    for (const sc of scenarios) {
      const warmPath = sc.path ?? sc.clientNav?.from;
      if (!warmPath) continue;
      await page.goto(fw.url + warmPath, { waitUntil: 'load', timeout: 15000 * timeoutScale });
      await page.waitForTimeout(TIMING.WARMUP_SETTLE_MS);
    }
  } catch (e) {
    console.log(`  ⚠️  Warmup failed for ${fw.name}: ${e.message}`);
  }

  await ctx.close();
  console.log(`  ✓ Warmup complete`);
}

async function main() {
  const runStart = Date.now();
  const runStartedAt = new Date().toISOString();
  const configPath = arg('--config', DEFAULT_CONFIG.pathname);
  const outPath = arg('--out', DEFAULT_OUT.pathname);
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const configIterations = Number(config.iterations ?? 5);
  const iterations = Number(arg('--iterations', String(configIterations)));
  const headless = !flag('--headed');
  const skipWarmup = flag('--skip-warmup');
  const warmupEnabled = skipWarmup ? false : Boolean(config.warmup ?? true);
  const scenarios = Array.isArray(config.scenarios) ? config.scenarios : DEFAULT_SCENARIOS;
  const frameworks = normalizeFrameworks(config.frameworks);
  const profileArg = arg('--profile', null);
  const iterationsArg = arg('--iterations', null);
  const cliArgs = process.argv.slice(2);
  const profiles = profileArg
    ? (profileArg === 'both' ? ['parity', 'idiomatic'] : [profileArg])
    : (Array.isArray(config.profiles) && config.profiles.length ? config.profiles : ['parity', 'idiomatic']);
  const profileSettings = config.profileSettings || {
    parity: { chartCache: 'no-store' },
    idiomatic: { chartCache: 'default' },
  };
  const throttleArg = arg('--throttle', null);
  const cpuArg = arg('--cpu', null);
  const networkArg = arg('--network', null);
  const cliThrottle = cpuArg || networkArg
    ? {
        cpu: Number.isFinite(Number(cpuArg)) ? Number(cpuArg) : undefined,
        network: networkArg || undefined,
      }
    : null;
  const iterationsByProfile = {};
  const warmupByProfile = {};
  const throttlingByProfile = {};
  const timeoutScaleByProfile = {};
  for (const p of profiles) {
    const settings = profileSettings[p] || {};
    const profileIterations = iterationsArg ? iterations : Number(settings.iterations ?? iterations);
    const profileWarmup = skipWarmup
      ? false
      : (typeof settings.warmup === 'boolean' ? settings.warmup : warmupEnabled);
    iterationsByProfile[p] = profileIterations;
    warmupByProfile[p] = profileWarmup;
    const throttling = resolveThrottling(config, profileSettings, p, cliThrottle || throttleArg);
    throttlingByProfile[p] = throttling || null;
    timeoutScaleByProfile[p] = timeoutScaleFor(throttling);
  }
  const iterationsLabel = (() => {
    const values = profiles.map((p) => iterationsByProfile[p]).filter((v) => Number.isFinite(v));
    const unique = [...new Set(values)];
    if (unique.length === 1) return String(unique[0]);
    return profiles.map((p) => `${p}=${iterationsByProfile[p]}`).join(', ');
  })();
  const warmupLabel = (() => {
    const values = profiles.map((p) => warmupByProfile[p]);
    const unique = [...new Set(values)];
    if (unique.length === 1) return unique[0] ? 'enabled' : 'disabled';
    return `per-profile (${profiles.map((p) => `${p}=${warmupByProfile[p] ? 'on' : 'off'}`).join(', ')})`;
  })();
  const warmupPaths = scenarios.map((sc) => sc.path ?? sc.clientNav?.from).filter(Boolean);
  const runOrder = {
    randomization: 'none',
    order: ['profile', 'framework', 'scenario', 'iteration', 'phase'],
    phaseOrder: ['cold', 'warm'],
    scenarioOrder: scenarios.map((sc) => sc.name),
  };
  const cpuList = os.cpus() || [];
  const systemInfo = {
    os: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      version: typeof os.version === 'function' ? os.version() : null,
    },
    cpu: {
      model: cpuList[0]?.model ?? null,
      speedMHz: cpuList[0]?.speed ?? null,
      cores: cpuList.length,
    },
    memory: {
      totalBytes: os.totalmem(),
      freeBytes: os.freemem(),
    },
  };
  const playwrightVersion = (() => {
    try {
      return require('playwright/package.json').version;
    } catch {
      return null;
    }
  })();
  const frameworkPackages = await collectFrameworkPackages(frameworks);
  const frameworkVersions = pickFrameworkVersions(frameworkPackages);
  const datasetInfo = await collectDatasetInfo();
  const gitInfo = getGitInfo();

  console.log(`\n🚀 Cloudflare Framework Benchmark`);
  console.log(`   Iterations: ${iterationsLabel}`);
  console.log(`   Warmup: ${warmupLabel}`);
  console.log(`   Frameworks: ${frameworks.length}`);
  console.log(`   Profiles: ${profiles.join(', ')}`);

  const webVitalsSrc = await loadWebVitalsScript();

  const browser = await chromium.launch({ headless });
  const browserVersion = browser.version();
  const browserEnv = await getBrowserEnv(browser);
  const benchApiByFramework = {};
  for (const fw of frameworks) {
    benchApiByFramework[fw.name] = await fetchBenchApi(browser, fw);
  }
  const all = [];
  const failures = [];
  const bundleSizes = {};

  const recordFailure = (row) => {
    if (!row || row.ok || row.skipped) return;
    failures.push({
      framework: row.framework,
      profile: row.profile,
      phase: row.phase,
      scenario: row.scenario,
      iteration: row.iteration,
      error: row.error || 'unknown_error',
      status: row.status ?? null,
    });
  };

  for (const profile of profiles) {
    const benchConfig = { profile, ...(profileSettings[profile] || {}) };
    const initScript = buildInitScript(webVitalsSrc, benchConfig);
    const benchHeaders = benchHeadersForProfile(profile);

    const profileIterations = iterationsByProfile[profile] ?? iterations;
    const profileWarmup = warmupByProfile[profile] ?? warmupEnabled;
    console.log(
      `\n🧪 Profile: ${profile} (chartCache=${benchConfig.chartCache || 'default'}, warmup=${profileWarmup ? 'on' : 'off'}, iterations=${profileIterations})`
    );
    const throttling = throttlingByProfile[profile] || null;
    const timeoutScale = timeoutScaleByProfile[profile] || 1;

    for (const fw of frameworks) {
      console.log(`\n▶ ${fw.name} (${fw.url})`);

      // Warmup phase - hit each route once to warm isolates
      if (profileWarmup) {
        await warmupFramework(browser, fw, initScript, scenarios, throttling, timeoutScale, benchHeaders);
      }

      // Initialize bundle size tracking for this framework
      bundleSizes[fw.name] = { js: 0, css: 0, total: 0, measured: false };

      for (const sc of scenarios) {
        for (let i = 0; i < profileIterations; i++) {
          const ctx = await browser.newContext({ viewport: VIEWPORT, extraHTTPHeaders: benchHeaders });
          await ctx.addInitScript({ content: initScript });
          const page = await ctx.newPage();
          const throttleApplied = await applyThrottling(page, throttling);

          // Sanity check
          try { await page.goto(fw.url + '/api/bench', { waitUntil: 'load' }); } catch { }

          const cold = await runScenario(
            page,
            fw,
            sc,
            i,
            'cold',
            bundleSizes,
            profile,
            throttling,
            timeoutScale,
            throttleApplied
          );
          all.push(cold);
          recordFailure(cold);

          let warm = null;
          if (!cold.skipped) {
            warm = await runScenario(
              page,
              fw,
              sc,
              i,
              'warm',
              bundleSizes,
              profile,
              throttling,
              timeoutScale,
              throttleApplied
            );
            all.push(warm);
            recordFailure(warm);
          }

          const ttfb = warm?.synthetic?.nav?.ttfb?.toFixed?.(1) ?? '—';
          const lcp = warm?.synthetic?.cwv?.lcp?.value?.toFixed?.(1) ?? '—';
          const tbt = warm?.synthetic?.longTasks?.tbt?.toFixed?.(1) ?? '—';
          const js = formatBytes(cold.synthetic?.resources?.js || 0);

          if (i === 0) {
            console.log(`  [1/${profileIterations}] ${sc.name} cold: ttfb=${cold.synthetic?.nav?.ttfb?.toFixed?.(1) ?? '—'}ms lcp=${cold.synthetic?.cwv?.lcp?.value?.toFixed?.(1) ?? '—'}ms tbt=${cold.synthetic?.longTasks?.tbt?.toFixed?.(1) ?? '—'}ms js=${js}`);
            if (warm) {
              console.log(`  [1/${profileIterations}] ${sc.name} warm: ttfb=${ttfb}ms lcp=${lcp}ms tbt=${tbt}ms`);
            }
          } else if (i === profileIterations - 1 && warm) {
            console.log(`  [${profileIterations}/${profileIterations}] ${sc.name} warm: ttfb=${ttfb}ms lcp=${lcp}ms tbt=${tbt}ms`);
          }

          await ctx.close();
        }
      }
    }
  }

  await browser.close();

  const failureSummary = new Map();
  for (const f of failures) {
    const key = `${f.framework}::${f.profile}::${f.phase}::${f.scenario}`;
    const bucket = failureSummary.get(key) || { count: 0, errors: new Map() };
    bucket.count += 1;
    const prev = bucket.errors.get(f.error) || 0;
    bucket.errors.set(f.error, prev + 1);
    failureSummary.set(key, bucket);
  }
  if (failures.length) {
    console.log(`\n⚠️  Failures: ${failures.length}`);
    for (const [key, data] of failureSummary.entries()) {
      const [framework, profile, phase, scenario] = key.split('::');
      const errorList = [...data.errors.entries()]
        .map(([err, count]) => `${err} (${count})`)
        .join(', ');
      console.log(`  ${framework} ${profile} ${phase} ${scenario}: ${data.count} failures — ${errorList}`);
    }
  }

  // Summary table for a couple key metrics per scenario
  const byKey = new Map();
  for (const row of all) {
    const key = `${row.framework}::${row.profile}::${row.phase}::${row.scenario}`;
    const bucket = byKey.get(key) || [];
    bucket.push(row);
    byKey.set(key, bucket);
  }

  const frameworkMetaByName = new Map(frameworks.map((fw) => [fw.name, fw]));

  const summary = [];
  for (const [key, rows] of byKey.entries()) {
    const [framework, profile, phase, scenario] = key.split('::');
    const meta = frameworkMetaByName.get(framework) || {};
    const delivery = meta.delivery ?? 'unknown';
    const rendering = meta.rendering?.[scenario] ?? 'unknown';
    const bucketKeyScenario = `${delivery}::${scenario}=${rendering}`;
    const ttfb = rows.map((r) => r.serverMetrics?.ttfb ?? r.synthetic?.nav?.ttfb).filter((x) => typeof x === 'number');
    const lcp = rows.map((r) => r.synthetic?.cwv?.lcp?.value).filter((x) => typeof x === 'number');
    const cls = rows.map((r) => r.synthetic?.cwv?.cls?.value).filter((x) => typeof x === 'number');
    const inp = rows.map((r) => r.synthetic?.cwv?.inp?.value).filter((x) => typeof x === 'number');
    const tbt = rows.map((r) => r.synthetic?.longTasks?.tbt).filter((x) => typeof x === 'number');
    const longTasksTotal = rows
      .map((r) => r.synthetic?.longTasks?.totalCount)
      .filter((x) => typeof x === 'number');
    const fcpMissing = rows.filter((r) => r.synthetic?.longTasks?.hasFcp === false).length;
    const heap = rows
      .map((r) => r.clientMetrics?.jsHeapUsedSize ?? r.memory?.JSHeapUsedSize)
      .filter((x) => typeof x === 'number');
    const cpuTask = rows
      .map((r) => r.clientMetrics?.taskDurationMs ?? toMs(r.memory?.TaskDuration))
      .filter((x) => typeof x === 'number');
    const cpuScript = rows
      .map((r) => r.clientMetrics?.scriptDurationMs ?? toMs(r.memory?.ScriptDuration))
      .filter((x) => typeof x === 'number');
    const scriptBootMs = cpuScript;
    const cpuLayout = rows
      .map((r) => r.clientMetrics?.layoutDurationMs ?? toMs(r.memory?.LayoutDuration))
      .filter((x) => typeof x === 'number');
    const cpuRecalc = rows
      .map((r) => r.clientMetrics?.recalcStyleDurationMs ?? toMs(r.memory?.RecalcStyleDuration))
      .filter((x) => typeof x === 'number');
    const chartSwitch = rows
      .map((r) => r.synthetic?.app?.chart?.switchDurationMs)
      .filter((x) => typeof x === 'number');
    const chartDraw = rows
      .map((r) => r.synthetic?.app?.chartCore?.lastDrawMs)
      .filter((x) => typeof x === 'number');
    const clientNav = rows.map((r) => r.clientNavMs).filter((x) => typeof x === 'number');
    const skipped = rows.filter((r) => r.skipped).length;
    const expected = rows.length - skipped;
    const ok = rows.filter((r) => r.ok).length;
    const failed = Math.max(0, expected - ok);
    const firstRow = phase === 'cold' ? rows.find((r) => r.iteration === 1 && r.ok) : null;
    const firstRequest = firstRow
      ? {
          ttfb: firstRow.serverMetrics?.ttfb ?? firstRow.synthetic?.nav?.ttfb ?? null,
          lcp: firstRow.synthetic?.cwv?.lcp?.value ?? null,
          cls: firstRow.synthetic?.cwv?.cls?.value ?? null,
          tbt: firstRow.synthetic?.longTasks?.tbt ?? null,
          heapUsed: firstRow.clientMetrics?.jsHeapUsedSize ?? firstRow.memory?.JSHeapUsedSize ?? null,
          cpuTaskMs: firstRow.clientMetrics?.taskDurationMs ?? toMs(firstRow.memory?.TaskDuration) ?? null,
        }
      : null;

    summary.push({
      framework,
      profile,
      phase,
      scenario,
      scenarioType: rows[0]?.scenarioType,
      bucketKeyScenario,
      samples: { expected, ok, failed, skipped },
      firstRequest,
      diagnostics: {
        longTasksTotal: summarize(longTasksTotal),
        fcpMissing,
        fcpMissingRate: expected ? fcpMissing / expected : null,
      },
      server: {
        ttfb: summarize(ttfb),
      },
      client: {
        lcp: summarize(lcp),
        cls: summarize(cls),
        inp: summarize(inp),
        tbt: summarize(tbt),
        heapUsed: summarize(heap),
        cpuTaskMs: summarize(cpuTask),
        cpuScriptMs: summarize(cpuScript),
        scriptBoot: summarize(scriptBootMs),
        cpuLayoutMs: summarize(cpuLayout),
        cpuRecalcStyleMs: summarize(cpuRecalc),
      },
      ttfb: summarize(ttfb),
      lcp: summarize(lcp),
      cls: summarize(cls),
      inp: summarize(inp),
      tbt: summarize(tbt),
      scriptBootMs: summarize(scriptBootMs),
      heapUsed: summarize(heap),
      cpuTaskMs: summarize(cpuTask),
      cpuScriptMs: summarize(cpuScript),
      chartSwitchMs: summarize(chartSwitch),
      chartDrawMs: summarize(chartDraw),
      clientNavMs: summarize(clientNav),
    });
  }

  // Generate comparison tables
  console.log(`\n📊 Summary (medians across ${iterationsLabel} iterations)\n`);
  console.log('   Note: TTFB is server/network; LCP/TBT/CPU/Heap are client-side metrics.\n');

  const frameworkNames = [...new Set(summary.map(s => s.framework))];
  const profileNames = [...new Set(summary.map(s => s.profile))];
  const scenarioNames = [...new Set(summary.filter(s => s.scenarioType !== 'client-nav').map(s => s.scenario))];
  const clientNavScenarios = [...new Set(summary.filter(s => s.scenarioType === 'client-nav').map(s => s.scenario))];
  const phases = [...new Set(summary.map(s => s.phase))];

  const metricWeights = { ttfb: 0.25, lcp: 0.4, tbt: 0.2, heap: 0.15 };
  const scenarioWeights = { home: 0.2, stays: 0.25, blog: 0.2, chart: 0.35, spa_nav: 0 };

  const bucketKeyForFramework = (fw) => {
    const delivery = fw?.delivery ?? 'unknown';
    const rendering = fw?.rendering ?? {};
    const home = rendering.home ?? 'unknown';
    const stays = rendering.stays ?? 'unknown';
    const blog = rendering.blog ?? 'unknown';
    const chart = rendering.chart ?? 'unknown';
    return `${delivery}::home=${home}::stays=${stays}::blog=${blog}::chart=${chart}`;
  };

  const formatBucketKey = (key) => key.replace(/::/g, ' | ');

  const buckets = new Map();
  for (const name of frameworkNames) {
    const meta = frameworkMetaByName.get(name) || {};
    const key = bucketKeyForFramework(meta);
    const bucket = buckets.get(key) || { key, frameworks: [] };
    bucket.frameworks.push(name);
    buckets.set(key, bucket);
  }

  const scoreProfilePhaseBucket = (profile, phase, frameworksInBucket) => {
    const incomplete = new Set();
    for (const fw of frameworksInBucket) {
      const scRows = summary
        .filter((s) => s.framework === fw && s.profile === profile && s.phase === phase)
        .filter((s) => s.scenarioType !== 'client-nav');
      if (scRows.length !== scenarioNames.length) {
        incomplete.add(fw);
        continue;
      }
      if (scRows.some((s) => s.samples && s.samples.expected > 0 && s.samples.ok < s.samples.expected)) {
        incomplete.add(fw);
      }
    }

    const eligible = frameworksInBucket.filter((fw) => !incomplete.has(fw));
    const scores = new Map(eligible.map((fw) => [fw, { score: 0, weight: 0 }]));
    for (const scenario of scenarioNames) {
      const scWeight = scenarioWeights[scenario] ?? 0.25;
      const scRows = summary
        .filter((s) => s.profile === profile && s.phase === phase && s.scenario === scenario)
        .filter((s) => eligible.includes(s.framework));
      const metrics = [
        { key: 'ttfb', get: (s) => s.ttfb.p50 },
        { key: 'lcp', get: (s) => s.lcp.p50 },
        { key: 'tbt', get: (s) => s.tbt.p50 },
        { key: 'heap', get: (s) => s.heapUsed.p50 },
      ];

      for (const m of metrics) {
        const values = scRows.map((s) => m.get(s)).filter((v) => Number.isFinite(v));
        if (!values.length) continue;
        const min = Math.min(...values);
        const max = Math.max(...values);
        if (min === max) continue;
        const weight = scWeight * (metricWeights[m.key] ?? 0);
        if (!weight) continue;

        for (const fw of eligible) {
          const entry = scRows.find((s) => s.framework === fw);
          const val = entry ? m.get(entry) : null;
          if (!Number.isFinite(val)) continue;
          const norm = (val - min) / (max - min);
          const bucket = scores.get(fw);
          bucket.score += norm * weight;
          bucket.weight += weight;
        }
      }
    }

    const rows = [...scores.entries()].map(([framework, data]) => ({
      framework,
      score: data.weight ? data.score / data.weight : null,
    }));
    for (const fw of incomplete) {
      rows.push({ framework: fw, score: null, incomplete: true });
    }

    return rows.sort((a, b) => {
      if (a.score == null && b.score == null) return 0;
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      return a.score - b.score;
    });
  };

  for (const profile of profileNames) {
    console.log(`\n=== Profile: ${profile} ===`);
    for (const phase of phases) {
      for (const scenario of scenarioNames) {
        const rowsForScenario = summary
          .filter((s) => s.profile === profile && s.phase === phase && s.scenario === scenario);
        const bucketsForScenario = new Map();
        for (const row of rowsForScenario) {
          const key = row.bucketKeyScenario || 'unknown';
          const bucket = bucketsForScenario.get(key) || [];
          bucket.push(row);
          bucketsForScenario.set(key, bucket);
        }

        const bucketKeys = [...bucketsForScenario.keys()].sort((a, b) => a.localeCompare(b));
        for (const bucketKey of bucketKeys) {
          const bucketRows = bucketsForScenario.get(bucketKey) || [];
          console.log(`\n${scenario.toUpperCase()} (${phase}) — ${formatBucketKey(bucketKey)}:`);
          console.log('┌────────────────────┬─────────┬─────────┬─────────┬─────────┬─────────┬───────────┬───────────┐');
          console.log('│ Framework          │ TTFB(S) │ LCP(C)  │ TBT(C)  │ Script(C) │ CPU(C)  │ JS Size   │ Heap(C)   │');
          console.log('├────────────────────┼─────────┼─────────┼─────────┼─────────┼─────────┼───────────┼───────────┤');

          for (const s of bucketRows) {
            const fw = s.framework;
            const ttfb = s.ttfb.p50?.toFixed(0) ?? '—';
            const lcp = s.lcp.p50?.toFixed(0) ?? '—';
            const tbt = s.tbt.p50?.toFixed(0) ?? '—';
            const script = s.scriptBootMs.p50?.toFixed(0) ?? '—';
            const cpu = s.cpuTaskMs.p50?.toFixed(0) ?? '—';
            const js = formatBytes(bundleSizes[fw]?.js || 0);
            const heap = formatBytes(s.heapUsed.p50 || 0);

            console.log(`│ ${fw.padEnd(18)} │ ${(ttfb + 'ms').padStart(7)} │ ${(lcp + 'ms').padStart(7)} │ ${(tbt + 'ms').padStart(7)} │ ${(script + 'ms').padStart(7)} │ ${(cpu + 'ms').padStart(7)} │ ${js.padStart(9)} │ ${heap.padStart(9)} │`);
          }
          console.log('└────────────────────┴─────────┴─────────┴─────────┴─────────┴─────────┴───────────┴───────────┘');

          if (scenario === 'chart') {
            console.log('\nChart interactions (p50):');
            console.log('┌────────────────────┬───────────┬───────────┐');
            console.log('│ Framework          │ Switch    │ Draw      │');
            console.log('├────────────────────┼───────────┼───────────┤');
            for (const s of bucketRows) {
              const fw = s.framework;
              const sw = formatDuration(s.chartSwitchMs.p50, 2);
              const dr = formatDuration(s.chartDrawMs.p50, 2);
              console.log(`│ ${fw.padEnd(18)} │ ${sw.padStart(9)} │ ${dr.padStart(9)} │`);
            }
            console.log('└────────────────────┴───────────┴───────────┘');
          }
        }
      }

      if (clientNavScenarios.length) {
        for (const scenario of clientNavScenarios) {
          console.log(`\n${scenario.toUpperCase()} (${phase}) — client nav:`);
          console.log('┌────────────────────┬───────────┬───────────┐');
          console.log('│ Framework          │ Nav       │ Heap      │');
          console.log('├────────────────────┼───────────┼───────────┤');
          for (const fw of frameworkNames) {
            const s = summary.find(x => x.framework === fw && x.profile === profile && x.scenario === scenario && x.phase === phase);
            if (!s) continue;
            const nav = s.clientNavMs.p50?.toFixed(0) ?? '—';
            const heap = formatBytes(s.heapUsed.p50 || 0);
            console.log(`│ ${fw.padEnd(18)} │ ${(nav + 'ms').padStart(9)} │ ${heap.padStart(9)} │`);
          }
          console.log('└────────────────────┴───────────┴───────────┘');
        }
      }

      console.log(`\nBucketed scores (${phase}, lower is better):`);
      for (const bucket of buckets.values()) {
        const scored = scoreProfilePhaseBucket(profile, phase, bucket.frameworks);
        if (!scored.length) continue;
        console.log(`  Bucket: ${formatBucketKey(bucket.key)}`);
        for (const row of scored) {
          const val = row.score == null ? (row.incomplete ? '— (incomplete)' : '—') : row.score.toFixed(3);
          console.log(`    ${row.framework}: ${val}`);
        }
      }
    }
  }

  const bucketScores = {};
  for (const profile of profileNames) {
    bucketScores[profile] = {};
    for (const phase of phases) {
      const byBucket = {};
      for (const bucket of buckets.values()) {
        byBucket[bucket.key] = scoreProfilePhaseBucket(profile, phase, bucket.frameworks);
      }
      bucketScores[profile][phase] = byBucket;
    }
  }

  const failureSummaryOut = {};
  for (const [key, data] of failureSummary.entries()) {
    failureSummaryOut[key] = {
      count: data.count,
      errors: Object.fromEntries(data.errors.entries()),
    };
  }

  const edgeLocations = summarizeEdgeLocations(all);
  const cacheStatusSummary = summarizeHeaderValues(all, 'cf-cache-status');
  const cacheControlSummary = summarizeHeaderValues(all, 'cache-control');
  const serverTimingSummary = summarizeServerTiming(all);

  const environment = {
    ...systemInfo,
    node: { version: process.version },
    playwright: { version: playwrightVersion },
    browser: { name: 'chromium', version: browserVersion, headless },
    viewport: VIEWPORT,
    browserEnv,
  };
  const configSnapshot = { path: configPath, data: config };
  const cli = {
    args: cliArgs,
    configPath,
    outPath,
    iterationsArg,
    profileArg,
    headless,
    skipWarmup,
  };

  const network = {
    throttlingProfiles: config.throttlingProfiles || {},
    throttlingByProfile,
    cliThrottle: cliThrottle || throttleArg || null,
  };
  const cache = {
    warmupDefault: warmupEnabled,
    warmupByProfile,
    warmupSettleMs: TIMING.WARMUP_SETTLE_MS,
    warmupPaths,
    profileSettings,
  };
  const provenance = {
    git: gitInfo,
    dataset: datasetInfo,
    frameworkPackages,
    frameworkVersions,
    benchApi: benchApiByFramework,
  };

  const runEnd = Date.now();
  const runEndedAt = new Date().toISOString();
  const durationMs = runEnd - runStart;

  const out = {
    ts: runEndedAt,
    runStartedAt,
    durationMs,
    environment,
    config: configSnapshot,
    cli,
    runOrder,
    scenarios,
    network,
    cache,
    provenance,
    edgeLocations,
    cacheStatusSummary,
    cacheControlSummary,
    serverTimingSummary,
    iterations,
    iterationsByProfile,
    warmupEnabled,
    warmupByProfile,
    profiles: profileNames,
    phases,
    frameworks: frameworks.map((fw) => ({
      name: fw.name,
      url: fw.url,
      delivery: fw.delivery ?? null,
      rendering: fw.rendering ?? null,
      features: fw.features ?? null,
      deploy: fw.deploy ?? null,
    })),
    bundleSizes,
    failures,
    failureSummary: failureSummaryOut,
    bucketScores,
    summary,
    rows: all
  };

  await fs.writeFile(outPath, JSON.stringify(out, null, 2));
  console.log(`\n✅ Results written to ${outPath}`);
  console.log(`Run duration: ${(durationMs / 1000).toFixed(1)}s`);

  // Also write a markdown summary
  const mdPath = outPath.replace('.json', '.md');
  let md = `# Framework Benchmark Results\n\n`;
  md += `Generated: ${runEndedAt}\n`;
  md += `Run started: ${runStartedAt}\n`;
  md += `Duration: ${(durationMs / 1000).toFixed(1)}s\n`;
  md += `Iterations: ${iterationsLabel}\n`;
  md += `Warmup: ${warmupEnabled ? 'enabled' : 'disabled'}\n\n`;
  md += `Profiles: ${profileNames.join(', ')}\n\n`;
  md += `Failures: ${failures.length}\n\n`;

  md += `## Run Metadata\n\n`;
  md += `| Field | Value |\n`;
  md += `|------|-------|\n`;
  md += `| Headless | ${headless ? 'true' : 'false'} |\n`;
  md += `| Viewport | ${VIEWPORT.width}x${VIEWPORT.height} |\n`;
  md += `| Browser | Chromium ${browserVersion || '—'} |\n`;
  md += `| Playwright | ${playwrightVersion || '—'} |\n`;
  md += `| Node | ${process.version} |\n`;
  md += `| OS | ${systemInfo.os.platform} ${systemInfo.os.release} (${systemInfo.os.arch}) |\n`;
  md += `| CPU | ${systemInfo.cpu.model || '—'} (${systemInfo.cpu.cores} cores) |\n`;
  md += `| RAM | ${formatBytes(systemInfo.memory.totalBytes)} |\n`;
  md += `| Timezone | ${browserEnv?.timeZone || '—'} |\n`;
  md += `| Locale | ${browserEnv?.language || '—'} |\n`;
  md += `| User agent | ${browserEnv?.userAgent || '—'} |\n`;
  md += `| Run order | ${runOrder.order.join(' -> ')} |\n`;
  md += `| Randomization | ${runOrder.randomization} |\n\n`;

  md += `## Scenarios\n\n`;
  md += `| Name | Type | Path | Wait for | Client nav |\n`;
  md += `|------|------|------|----------|------------|\n`;
  for (const sc of scenarios) {
    const pathVal = sc.path || '—';
    const waitFor = sc.waitFor || sc.clientNav?.waitFor || '—';
    const navPattern = sc.clientNav?.toPattern;
    const navTo = sc.clientNav?.to
      || (navPattern instanceof RegExp ? navPattern.toString() : navPattern)
      || '—';
    const clientNav = sc.clientNav
      ? `${sc.clientNav.from || '—'} -> ${navTo}`
      : '—';
    md += `| ${sc.name} | ${sc.type} | ${pathVal} | ${waitFor} | ${clientNav} |\n`;
  }
  md += '\n';

  md += `## Network & Cache\n\n`;
  md += `| Field | Value |\n`;
  md += `|------|-------|\n`;
  const throttlingSummary = cliThrottle || throttleArg || config.throttling || 'none';
  const throttlingLabel = typeof throttlingSummary === 'string' ? throttlingSummary : JSON.stringify(throttlingSummary);
  md += `| Network throttling | ${throttlingLabel} (per profile) |\n`;
  md += `| CPU throttling | ${throttlingLabel} (per profile) |\n`;
  md += `| Warmup default | ${warmupEnabled ? 'enabled' : 'disabled'} |\n`;
  md += `| Warmup settle | ${TIMING.WARMUP_SETTLE_MS}ms |\n`;
  md += `| Warmup paths | ${warmupPaths.length ? warmupPaths.join(', ') : '—'} |\n`;
  md += `| Chart cache profiles | ${Object.entries(profileSettings).map(([k, v]) => `${k}=${v.chartCache || 'default'}`).join(', ')} |\n\n`;

  md += `### Throttling profiles\n\n`;
  md += `| Profile | Throttling |\n`;
  md += `|---------|------------|\n`;
  for (const p of profileNames) {
    const t = throttlingByProfile[p];
    md += `| ${p} | ${t ? JSON.stringify(t) : 'none'} |\n`;
  }
  md += '\n';

  md += `### Warmup & iterations by profile\n\n`;
  md += `| Profile | Warmup | Iterations |\n`;
  md += `|---------|--------|-----------:|\n`;
  for (const p of profileNames) {
    const warm = warmupByProfile[p];
    const iter = iterationsByProfile[p];
    md += `| ${p} | ${warm ? 'enabled' : 'disabled'} | ${Number.isFinite(iter) ? iter : '—'} |\n`;
  }
  md += '\n';

  md += `## Provenance\n\n`;
  md += `| Field | Value |\n`;
  md += `|------|-------|\n`;
  md += `| Git commit | ${gitInfo?.commit || '—'} |\n`;
  md += `| Git branch | ${gitInfo?.branch || '—'} |\n`;
  md += `| Git describe | ${gitInfo?.describe || '—'} |\n`;
  md += `| Git dirty | ${gitInfo ? (gitInfo.dirty ? 'true' : 'false') : '—'} |\n`;
  md += `| Dataset | ${datasetInfo ? `${datasetInfo.name}@${datasetInfo.version}` : '—'} |\n\n`;

  md += `### Framework versions\n\n`;
  md += `| Framework | Packages |\n`;
  md += `|-----------|----------|\n`;
  for (const fw of frameworkNames) {
    const versions = frameworkVersions[fw];
    const list = versions
      ? Object.entries(versions).map(([pkg, ver]) => `${pkg}@${ver}`).join(', ')
      : '—';
    md += `| ${fw} | ${list || '—'} |\n`;
  }
  md += '\n';

  md += `### Deploy metadata (config)\n\n`;
  md += `| Framework | Deploy |\n`;
  md += `|-----------|--------|\n`;
  for (const fw of frameworks) {
    const deploy = fw.deploy ? JSON.stringify(fw.deploy) : '—';
    md += `| ${fw.name} | ${deploy} |\n`;
  }
  md += '\n';

  md += `### Bench API snapshot\n\n`;
  md += `| Framework | Status | Isolate | Server time | CF-Ray | Cache |\n`;
  md += `|-----------|-------:|---------|-------------|--------|-------|\n`;
  for (const fw of frameworkNames) {
    const api = benchApiByFramework[fw];
    const status = api?.status ?? '—';
    const isolate = api?.data?.isolateId ?? '—';
    const serverNow = api?.data?.now ?? '—';
    const cfRay = api?.headers?.['cf-ray'] ?? '—';
    const cacheStatus = api?.headers?.['cf-cache-status'] ?? '—';
    md += `| ${fw} | ${status} | ${isolate} | ${serverNow} | ${cfRay} | ${cacheStatus} |\n`;
  }
  md += '\n';

  md += `## Edge & Cache Summary\n\n`;
  md += `### Cloudflare colos (cf-ray)\n\n`;
  md += `| Colo | Count |\n`;
  md += `|------|------:|\n`;
  if (edgeLocations.distinct.length) {
    for (const colo of edgeLocations.distinct) {
      md += `| ${colo} | ${edgeLocations.byColo[colo]} |\n`;
    }
  } else {
    md += `| — | 0 |\n`;
  }
  md += '\n';

  md += `### cf-cache-status\n\n`;
  md += `| Value | Count |\n`;
  md += `|-------|------:|\n`;
  const cacheStatusEntries = Object.entries(cacheStatusSummary).sort(([a], [b]) => a.localeCompare(b));
  if (cacheStatusEntries.length) {
    for (const [val, count] of cacheStatusEntries) {
      md += `| ${val} | ${count} |\n`;
    }
  } else {
    md += `| — | 0 |\n`;
  }
  md += '\n';

  md += `### cache-control\n\n`;
  md += `| Value | Count |\n`;
  md += `|-------|------:|\n`;
  const cacheControlEntries = Object.entries(cacheControlSummary).sort(([a], [b]) => a.localeCompare(b));
  if (cacheControlEntries.length) {
    for (const [val, count] of cacheControlEntries) {
      md += `| ${val} | ${count} |\n`;
    }
  } else {
    md += `| — | 0 |\n`;
  }
  md += '\n';

  md += `## Server Timing Summary\n\n`;
  md += `| Name | Count | p50 | p95 | Max |\n`;
  md += `|------|------:|----:|----:|----:|\n`;
  const timingEntries = Object.entries(serverTimingSummary).sort(([a], [b]) => a.localeCompare(b));
  if (timingEntries.length) {
    for (const [name, data] of timingEntries) {
      const p50 = data.durMs?.p50 != null ? data.durMs.p50.toFixed(1) : '—';
      const p95 = data.durMs?.p95 != null ? data.durMs.p95.toFixed(1) : '—';
      const max = data.durMs?.max != null ? data.durMs.max.toFixed(1) : '—';
      md += `| ${name} | ${data.count} | ${p50}ms | ${p95}ms | ${max}ms |\n`;
    }
  } else {
    md += `| — | 0 | — | — | — |\n`;
  }
  md += '\n';

  md += `## Config Snapshot\n\n`;
  md += `\`\`\`json\n${JSON.stringify(config, null, 2)}\n\`\`\`\n\n`;

  md += `## Bundle Sizes\n\n`;
  md += `| Framework | JS | CSS | Total |\n`;
  md += `|-----------|---:|----:|------:|\n`;
  for (const fw of frameworkNames) {
    const b = bundleSizes[fw];
    md += `| ${fw} | ${formatBytes(b?.js || 0)} | ${formatBytes(b?.css || 0)} | ${formatBytes(b?.total || 0)} |\n`;
  }

  md += `\n## Performance Metrics (p50)\n\n`;
  md += `Note: TTFB is server/network; LCP/TBT/CPU/Heap are client-side metrics.\n\n`;
  for (const profile of profileNames) {
    md += `### Profile: ${profile}\n\n`;
    for (const phase of phases) {
      md += `#### ${phase.toUpperCase()}\n\n`;
      for (const scenario of scenarioNames) {
        const rowsForScenario = summary
          .filter((s) => s.profile === profile && s.phase === phase && s.scenario === scenario);
        const bucketsForScenario = new Map();
        for (const row of rowsForScenario) {
          const key = row.bucketKeyScenario || 'unknown';
          const bucket = bucketsForScenario.get(key) || [];
          bucket.push(row);
          bucketsForScenario.set(key, bucket);
        }
        const bucketKeys = [...bucketsForScenario.keys()].sort((a, b) => a.localeCompare(b));
        for (const bucketKey of bucketKeys) {
          const bucketRows = bucketsForScenario.get(bucketKey) || [];
          md += `##### ${scenario.charAt(0).toUpperCase() + scenario.slice(1)} — ${formatBucketKey(bucketKey)}\n\n`;
          md += `| Framework | TTFB (server) | LCP (client) | TBT (client) | Script (client) | CPU (client) | Heap (client) |\n`;
          md += `|-----------|--------------:|-------------:|-------------:|---------------:|-------------:|--------------:|\n`;
          for (const s of bucketRows) {
            md += `| ${s.framework} | ${s.ttfb.p50?.toFixed(0) ?? '—'}ms | ${s.lcp.p50?.toFixed(0) ?? '—'}ms | ${s.tbt.p50?.toFixed(0) ?? '—'}ms | ${s.scriptBootMs.p50?.toFixed(0) ?? '—'}ms | ${s.cpuTaskMs.p50?.toFixed(0) ?? '—'}ms | ${formatBytes(s.heapUsed.p50 || 0)} |\n`;
          }
          md += '\n';
          md += `Sample counts:\n\n`;
          md += `| Framework | ok/expected | skipped | failed | TTFB n | LCP n | TBT n | Script n | CPU n | Heap n |\n`;
          md += `|-----------|------------:|--------:|-------:|-------:|------:|------:|---------:|------:|-------:|\n`;
          for (const s of bucketRows) {
            const samples = s.samples || { expected: 0, ok: 0, failed: 0, skipped: 0 };
            const okExpected = samples.expected ? `${samples.ok}/${samples.expected}` : '0/0';
            const ttfbN = s.ttfb.n ?? 0;
            const lcpN = s.lcp.n ?? 0;
            const tbtN = s.tbt.n ?? 0;
            const scriptN = s.scriptBootMs.n ?? 0;
            const cpuN = s.cpuTaskMs.n ?? 0;
            const heapN = s.heapUsed.n ?? 0;
            md += `| ${s.framework} | ${okExpected} | ${samples.skipped ?? 0} | ${samples.failed ?? 0} | ${ttfbN} | ${lcpN} | ${tbtN} | ${scriptN} | ${cpuN} | ${heapN} |\n`;
          }
          md += '\n';
          md += `Diagnostics:\n\n`;
          md += `| Framework | Longtasks p50 | FCP missing |\n`;
          md += `|-----------|--------------:|------------:|\n`;
          for (const s of bucketRows) {
            const ltP50 = s.diagnostics?.longTasksTotal?.p50;
            const fcpMissing = s.diagnostics?.fcpMissing ?? 0;
            md += `| ${s.framework} | ${ltP50 != null ? ltP50.toFixed(0) : '—'} | ${fcpMissing} |\n`;
          }
          md += '\n';
          if (scenario === 'chart') {
            md += `| Framework | Chart switch | Chart draw |\n`;
            md += `|-----------|-------------:|-----------:|\n`;
            for (const s of bucketRows) {
              const sw = formatDuration(s.chartSwitchMs.p50, 2);
              const dr = formatDuration(s.chartDrawMs.p50, 2);
              md += `| ${s.framework} | ${sw} | ${dr} |\n`;
            }
            md += '\n';
          }
        }
      }

      if (clientNavScenarios.length) {
        for (const scenario of clientNavScenarios) {
          md += `##### ${scenario.replace('_', ' ').toUpperCase()} (client nav)\n\n`;
          md += `| Framework | Nav | Heap |\n`;
          md += `|-----------|----:|-----:|\n`;
          for (const fw of frameworkNames) {
            const s = summary.find(x => x.framework === fw && x.profile === profile && x.scenario === scenario && x.phase === phase);
            if (!s) continue;
            md += `| ${fw} | ${s.clientNavMs.p50?.toFixed(0) ?? '—'}ms | ${formatBytes(s.heapUsed.p50 || 0)} |\n`;
          }
          md += '\n';
          md += `Sample counts:\n\n`;
          md += `| Framework | ok/expected | skipped | failed | Nav n | Heap n |\n`;
          md += `|-----------|------------:|--------:|-------:|------:|-------:|\n`;
          for (const fw of frameworkNames) {
            const s = summary.find(x => x.framework === fw && x.profile === profile && x.scenario === scenario && x.phase === phase);
            if (!s) continue;
            const samples = s.samples || { expected: 0, ok: 0, failed: 0, skipped: 0 };
            const okExpected = samples.expected ? `${samples.ok}/${samples.expected}` : '0/0';
            const navN = s.clientNavMs.n ?? 0;
            const heapN = s.heapUsed.n ?? 0;
            md += `| ${fw} | ${okExpected} | ${samples.skipped ?? 0} | ${samples.failed ?? 0} | ${navN} | ${heapN} |\n`;
          }
          md += '\n';
        }
      }
    }
  }

  if (!warmupEnabled) {
    md += `\n## First Request (cold iteration 1)\n\n`;
    md += `Captured only when warmup is disabled.\n\n`;
    for (const profile of profileNames) {
      md += `### Profile: ${profile}\n\n`;
      for (const scenario of scenarioNames) {
        const rowsForScenario = summary
          .filter((s) => s.profile === profile && s.phase === 'cold' && s.scenario === scenario)
          .filter((s) => s.firstRequest);
        const bucketsForScenario = new Map();
        for (const row of rowsForScenario) {
          const key = row.bucketKeyScenario || 'unknown';
          const bucket = bucketsForScenario.get(key) || [];
          bucket.push(row);
          bucketsForScenario.set(key, bucket);
        }
        const bucketKeys = [...bucketsForScenario.keys()].sort((a, b) => a.localeCompare(b));
        for (const bucketKey of bucketKeys) {
          const bucketRows = bucketsForScenario.get(bucketKey) || [];
          md += `#### ${scenario.charAt(0).toUpperCase() + scenario.slice(1)} — ${formatBucketKey(bucketKey)}\n\n`;
          md += `| Framework | TTFB | LCP | CLS | TBT | CPU | Heap |\n`;
          md += `|-----------|-----:|----:|----:|----:|----:|-----:|\n`;
          for (const s of bucketRows) {
            const first = s.firstRequest || {};
            md += `| ${s.framework} | ${first.ttfb != null ? first.ttfb.toFixed(0) : '—'}ms | ${first.lcp != null ? first.lcp.toFixed(0) : '—'}ms | ${first.cls != null ? first.cls.toFixed(3) : '—'} | ${first.tbt != null ? first.tbt.toFixed(0) : '—'}ms | ${first.cpuTaskMs != null ? first.cpuTaskMs.toFixed(0) : '—'}ms | ${formatBytes(first.heapUsed || 0)} |\n`;
          }
          md += '\n';
        }
      }
    }
  }

  md += `\n## Bucketed Scores\n\n`;
  for (const profile of profileNames) {
    md += `### Profile: ${profile}\n\n`;
    for (const phase of phases) {
      md += `#### ${phase.toUpperCase()}\n\n`;
      for (const bucket of buckets.values()) {
        const scored = scoreProfilePhaseBucket(profile, phase, bucket.frameworks);
        if (!scored.length) continue;
        md += `##### Bucket: ${formatBucketKey(bucket.key)}\n\n`;
        md += `| Framework | Score |\n`;
        md += `|-----------|------:|\n`;
        for (const row of scored) {
          const score = row.score == null ? (row.incomplete ? '— (incomplete)' : '—') : row.score.toFixed(3);
          md += `| ${row.framework} | ${score} |\n`;
        }
        md += `\n`;
      }
    }
  }

  md += `\n## Glossary\n\n`;
  md += `| Metric | Unit | Source | Definition |\n`;
  md += `|--------|------|--------|------------|\n`;
  md += `| TTFB (server) | ms | Navigation Timing | responseStart for the document. Includes network + server time. |\n`;
  md += `| LCP (client) | ms | Web Vitals | Largest Contentful Paint timing. |\n`;
  md += `| CLS (client) | score | Web Vitals | Cumulative Layout Shift score. |\n`;
  md += `| INP (client) | ms | Web Vitals | Interaction to Next Paint. |\n`;
  md += `| FCP (client) | ms | Web Vitals/Paint Timing | First Contentful Paint. |\n`;
  md += `| TBT (client) | ms | Long Tasks | Sum of blocking time over 50ms between FCP and FCP + 5000ms. |\n`;
  md += `| Script boot (client) | ms | CDP Performance.getMetrics | ScriptDuration during page load (proxy for boot cost). |\n`;
  md += `| CPU Task (client) | ms | CDP Performance.getMetrics | Cumulative main-thread task time. |\n`;
  md += `| CPU Script (client) | ms | CDP Performance.getMetrics | Time spent executing JS on the main thread. |\n`;
  md += `| CPU Layout (client) | ms | CDP Performance.getMetrics | Time spent in layout on the main thread. |\n`;
  md += `| CPU RecalcStyle (client) | ms | CDP Performance.getMetrics | Time spent recalculating styles. |\n`;
  md += `| Heap Used (client) | bytes | CDP Performance.getMetrics | JSHeapUsedSize. Shown as KB/MB in tables. |\n`;
  md += `| Heap Total (client) | bytes | CDP Performance.getMetrics | JSHeapTotalSize. |\n`;
  md += `| Resources (client) | bytes | Resource Timing | Transfer size buckets for JS/CSS/img/font/other. |\n`;
  md += `| Chart switch | ms | App marker | window.__CF_BENCH__.chart.switchDurationMs. |\n`;
  md += `| Chart draw | ms | App marker | window.__CF_BENCH__.chartCore.lastDrawMs. |\n`;
  md += `| Client nav | ms | App timing | Click-to-route completion for client-nav scenario. |\n`;
  md += `\n`;
  md += `Phases: cold is first navigation in a fresh browser context; warm is a reload in the same context.\n`;
  md += `Profiles: parity uses no-store for chart fetches; idiomatic uses framework defaults.\n`;

  await fs.writeFile(new URL(mdPath, 'file://'), md);
  console.log(`📝 Markdown summary written to ${mdPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
