import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, devices } from 'playwright';
import { buildCloudflareAudit } from '../../scripts/cloudflare-config-audit.mjs';
import { buildOptimizationAudit } from '../../scripts/cloudflare-optimization-audit.mjs';
import { DEFAULT_TARGETS_PATH } from './config-v4.mjs';
import { provenanceHashForRow, sha256 } from './provenance.mjs';
import { buildMarkdown, formatBytes, formatDuration } from './report.mjs';

export { provenanceHashForRow } from './provenance.mjs';

const require = createRequire(import.meta.url);
const BENCH_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(BENCH_ROOT, '..');
const CLOUDFLARE_PLATFORM_ERAS_PATH = 'bench/cloudflare-platform-eras.json';

const DEFAULT_OUT = new URL('../results.v4.json', import.meta.url);
const NON_CANONICAL_RESULT_SUFFIXES = ['.smoke.', '.dirty.', '.flame.', '.stability.'];

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

function resolveDeviceContext(profileSettings) {
  const deviceName = profileSettings?.device;
  if (!deviceName) return { viewport: VIEWPORT };
  const dev = devices[deviceName];
  if (!dev) {
    console.warn(`Unknown Playwright device "${deviceName}", falling back to default viewport.`);
    return { viewport: VIEWPORT };
  }
  return { ...dev };
}

function arg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

async function connectRealDevice(target) {
  const [providerRaw, deviceRaw] = String(target).split(':', 2);
  const provider = (providerRaw || '').toLowerCase();
  const device = (deviceRaw || '').toLowerCase();
  if (provider !== 'browserstack') {
    throw new Error(`--realdevice supports only browserstack:* targets (got ${target}).`);
  }
  const user = process.env.BROWSERSTACK_USER;
  const key = process.env.BROWSERSTACK_KEY;
  if (!user || !key) {
    throw new Error('--realdevice browserstack:* requires BROWSERSTACK_USER and BROWSERSTACK_KEY env vars.');
  }
  const caps = {
    browser: 'chrome',
    realMobile: 'true',
    'browserstack.user': user,
    'browserstack.key': key,
    'browserstack.local': 'false',
    'browserstack.video': 'false',
    name: 'cf-bench-realdevice',
    project: 'cf-framework-benchmark',
  };
  if (device === 'iphone-13') {
    caps.os = 'ios';
    caps.os_version = '15';
    caps.device = 'iPhone 13';
  } else if (device === 'pixel-7') {
    caps.os = 'android';
    caps.os_version = '13.0';
    caps.device = 'Google Pixel 7';
  } else {
    throw new Error(`Unknown browserstack device "${deviceRaw}". Supported: iphone-13, pixel-7.`);
  }
  const wsEndpoint = `wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify(caps))}`;
  return chromium.connect(wsEndpoint);
}

function flag(name) {
  return process.argv.includes(name);
}

export function isCanonicalResultPath(outPath) {
  const baseName = path.basename(outPath);
  return !NON_CANONICAL_RESULT_SUFFIXES.some((suffix) => baseName.includes(suffix));
}

export function assertCanonicalResultWritable({ outPath, gitInfo, allowDirtyProvenance = false }) {
  const canonical = isCanonicalResultPath(outPath);
  const dirty = Boolean(gitInfo?.dirty);
  if (canonical && dirty && !allowDirtyProvenance) {
    throw new Error(
      `Refusing to write canonical results to ${outPath}: git working tree is dirty.\n` +
      `Commit or stash changes before running a canonical benchmark, or:\n` +
      `  - Use a suffixed output path (e.g. results.v4.<suite>.dirty.json)\n` +
      `  - Pass --allow-dirty-provenance to override this check`
    );
  }
  return {
    canonical,
    dirty,
    dirtyCanonicalOverride: canonical && dirty && allowDirtyProvenance,
  };
}

export function benchmarkContractHashInput() {
  return {
    version: 2,
    contracts: {
      v5: hashFile('docs/contracts-v5.md') || hashFile('docs/contracts-v3.md'),
      v6Addendum: hashFile('docs/contracts-v6-addendum.md'),
      contractsJson: hashFile('contracts/v5.json'),
    },
  };
}

export function benchmarkContractHash() {
  return sha256(benchmarkContractHashInput());
}

const SCORING_RUBRIC_PATH = 'bench/scoring-rubric.json';

export function loadScoringRubric() {
  const fullPath = path.resolve(REPO_ROOT, SCORING_RUBRIC_PATH);
  const raw = readFileSync(fullPath, 'utf8');
  const rubric = JSON.parse(raw);
  if (!rubric || typeof rubric.model !== 'string' || !rubric.metricWeights || !rubric.scenarioWeights) {
    throw new Error(`${SCORING_RUBRIC_PATH} must include model, metricWeights, scenarioWeights.`);
  }
  const sumMetric = Object.values(rubric.metricWeights).reduce((s, w) => s + Number(w || 0), 0);
  if (Math.abs(sumMetric - 1) > 1e-6) {
    throw new Error(`${SCORING_RUBRIC_PATH}: metricWeights must sum to 1.0 (got ${sumMetric}).`);
  }
  const suiteIds = Object.keys(rubric.scenarioWeights);
  if (!suiteIds.length) {
    throw new Error(`${SCORING_RUBRIC_PATH}: scenarioWeights must declare at least one suite (mpa_airbnb, spa_trading_media, mpa_airbnb_hifi, ...).`);
  }
  for (const suiteId of suiteIds) {
    const weights = rubric.scenarioWeights[suiteId];
    if (!weights || typeof weights !== 'object' || Array.isArray(weights)) {
      throw new Error(`${SCORING_RUBRIC_PATH}: scenarioWeights["${suiteId}"] must be an object mapping scenario name → weight.`);
    }
    const sum = Object.values(weights).reduce((s, w) => s + Number(w || 0), 0);
    if (Math.abs(sum - 1) > 1e-6) {
      throw new Error(`${SCORING_RUBRIC_PATH}: scenarioWeights["${suiteId}"] must sum to 1.0 (got ${sum}).`);
    }
  }
  if (rubric.profileMetricWeights !== undefined) {
    if (!rubric.profileMetricWeights || typeof rubric.profileMetricWeights !== 'object' || Array.isArray(rubric.profileMetricWeights)) {
      throw new Error(`${SCORING_RUBRIC_PATH}: profileMetricWeights must be an object mapping profile → metric overrides.`);
    }
    for (const [profile, override] of Object.entries(rubric.profileMetricWeights)) {
      if (!override || typeof override !== 'object' || Array.isArray(override)) {
        throw new Error(`${SCORING_RUBRIC_PATH}: profileMetricWeights["${profile}"] must be an object.`);
      }
      const effective = { ...rubric.metricWeights, ...override };
      const sumEffective = Object.values(effective).reduce((s, w) => s + Number(w || 0), 0);
      if (Math.abs(sumEffective - 1) > 1e-6) {
        throw new Error(
          `${SCORING_RUBRIC_PATH}: profileMetricWeights["${profile}"] does not sum to 1.0 with non-overridden defaults (got ${sumEffective}). ` +
          `Each profile's override + non-overridden defaults must sum to 1.0.`
        );
      }
    }
  }
  return rubric;
}

export function effectiveMetricWeight(metric, profile, rubric) {
  const profiles = rubric.profileMetricWeights || null;
  if (profiles) {
    const override = profiles[profile] ?? profiles['*'] ?? null;
    if (override && Object.prototype.hasOwnProperty.call(override, metric)) {
      return Number(override[metric] || 0);
    }
  }
  return Number(rubric.metricWeights?.[metric] || 0);
}

export function scoringRubricHash() {
  return hashFile(SCORING_RUBRIC_PATH);
}

export function suitesHashInput() {
  const suitesDir = path.resolve(REPO_ROOT, 'bench/suites');
  const entries = readdirSync(suitesDir)
    .filter((name) => name.endsWith('.json'))
    .sort();
  const out = {};
  for (const entry of entries) {
    out[entry] = hashFile(path.join('bench/suites', entry));
  }
  return out;
}

export function suitesHash() {
  return sha256(suitesHashInput());
}

function parseCsvSet(value) {
  const tokens = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return new Set(tokens);
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

function sanitizePathToken(input, fallback = 'unknown') {
  const value = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return value || fallback;
}

function safeExec(command) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function seedBigInt(seed) {
  const hex = sha256(seed).slice(0, 16);
  const value = BigInt('0x' + hex) & ((1n << 64n) - 1n);
  return value === 0n ? 1n : value;
}

function createPrng(seed) {
  let state = seedBigInt(seed);
  return () => {
    state = (state * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n);
    return Number(state >> 11n) / 2 ** 53;
  };
}

function shuffled(items, seed) {
  const out = [...items];
  const random = createPrng(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function getGitInfo() {
  const commit = safeExec('git rev-parse HEAD');
  if (!commit) return null;
  const branch = safeExec('git rev-parse --abbrev-ref HEAD');
  const describe = safeExec('git describe --tags --always --dirty');
  const dirty = Boolean(safeExec('git status --porcelain'));
  return { commit, branch, describe, dirty };
}

function hashFile(relativePath) {
  try {
    const fullPath = path.resolve(REPO_ROOT, relativePath);
    return sha256(readFileSync(fullPath, 'utf8'));
  } catch {
    return null;
  }
}

function relativeRepoPath(filePath) {
  if (!filePath) return null;
  return path.relative(REPO_ROOT, filePath);
}

function stableCloudflareAuditInput(report) {
  return {
    schemaVersion: report.schemaVersion,
    ok: report.ok,
    gapCount: report.gapCount,
    frameworkCount: report.frameworkCount,
    enabledWorkersCount: report.enabledWorkersCount,
    frameworks: report.frameworks.map((row) => ({
      name: row.name,
      tier: row.tier,
      status: row.status,
      benchmarkEnabled: row.benchmarkEnabled,
      deployType: row.deployType,
      cloudflare: row.cloudflare,
      wrangler: row.wrangler
        ? {
            ...row.wrangler,
            configPath: relativeRepoPath(row.wrangler.configPath),
          }
        : null,
      gaps: row.gaps,
      ok: row.ok,
    })),
  };
}

function stableCloudflareOptimizationAuditInput(report) {
  return {
    schemaVersion: report.schemaVersion,
    ok: report.ok,
    gaps: report.gaps ?? [],
    frameworkCount: report.frameworkCount,
    enabledFrameworkCount: report.enabledFrameworkCount,
    riskCounts: report.riskCounts ?? {},
    optimizationSourceRequirements: report.optimizationSourceRequirements ?? [],
    optimizationVariants: report.optimizationVariants ?? null,
    traceCorrelation: report.traceCorrelation
      ? {
          id: report.traceCorrelation.id,
          class: report.traceCorrelation.class,
          status: report.traceCorrelation.status,
          capturedHeaders: report.traceCorrelation.capturedHeaders ?? [],
          derivedFields: report.traceCorrelation.derivedFields ?? [],
        }
      : null,
    rows: (report.rows ?? []).map((row) => ({
      name: row.name,
      tier: row.tier,
      status: row.status,
      benchmarkEnabled: row.benchmarkEnabled,
      appDir: row.appDir,
      workerEntrypoint: row.workerEntrypoint ?? null,
      workerdLocalHarness: row.workerdLocalHarness ?? null,
      assetCaching: row.assetCaching
        ? {
            headersPath: row.assetCaching.headersPath,
            staticAssetFileCount: row.assetCaching.staticAssetFileCount,
            immutableAssetHeaders: row.assetCaching.immutableAssetHeaders,
            routeCacheEvidence: row.assetCaching.routeCacheEvidence,
          }
        : null,
      prefetch: row.prefetch ?? null,
      optimizationVariants: row.optimizationVariants ?? [],
      openNextCacheModes: row.openNextCacheModes ?? [],
      boundaryLeakCount: row.boundaryLeaks?.length ?? 0,
      routes: row.routes ?? null,
      risks: row.risks ?? [],
      disclosures: row.disclosures ?? [],
    })),
  };
}

async function readJsonFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function collectCloudflarePlatformEras() {
  return await readJsonFile(path.join(REPO_ROOT, CLOUDFLARE_PLATFORM_ERAS_PATH));
}

async function collectFrameworkPackages(frameworks) {
  const out = {};
  for (const fw of frameworks) {
    const pkgPath = path.join(REPO_ROOT, 'apps', fw.name, 'package.json');
    const pkg = await readJsonFile(pkgPath);
    out[fw.name] = pkg
      ? {
          path: path.relative(REPO_ROOT, pkgPath),
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
  const pkgPath = path.join(REPO_ROOT, 'packages', 'dataset', 'package.json');
  const pkg = await readJsonFile(pkgPath);
  if (!pkg) return null;
  return {
    path: path.relative(REPO_ROOT, pkgPath),
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

export function pickFrameworkVersions(frameworks, frameworkPackages) {
  const out = {};
  for (const fw of frameworks) {
    const name = fw.name;
    const pkg = frameworkPackages[name];
    if (!pkg) {
      out[name] = null;
      continue;
    }
    const keys = Array.isArray(fw.versionPackages) ? fw.versionPackages : [];
    if (!keys.length) {
      throw new Error(`pickFrameworkVersions: framework "${name}" has no versionPackages declared. Set versionPackages in bench/framework-matrix.json.`);
    }
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
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

function headerValue(headers, name) {
  if (!headers || !name) return null;
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lower) continue;
    if (Array.isArray(value)) return value.join(', ');
    return value == null ? null : String(value);
  }
  return null;
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
    const colo = row?.trace?.colo ?? extractColo(row?.headers?.['cf-ray']);
    if (!colo) continue;
    byColo[colo] = (byColo[colo] || 0) + 1;
  }
  const distinct = Object.keys(byColo).sort();
  const total = distinct.reduce((sum, colo) => sum + byColo[colo], 0);
  return { byColo, distinct, total };
}

function summarizeTraceCorrelation(rows) {
  const byColo = {};
  const headerCoverage = {
    cfRay: 0,
    colo: 0,
    cacheStatus: 0,
    serverTiming: 0,
    cacheControl: 0,
    link: 0,
    earlyHints: 0,
    age: 0,
    date: 0,
  };
  for (const row of rows) {
    const trace = row?.trace ?? cloudflareTraceMetadata(row?.headers ?? {});
    if (!trace) continue;
    if (trace.cfRay) headerCoverage.cfRay += 1;
    if (trace.colo) headerCoverage.colo += 1;
    if (trace.cacheStatus) headerCoverage.cacheStatus += 1;
    if (Array.isArray(trace.serverTiming) && trace.serverTiming.length) headerCoverage.serverTiming += 1;
    if (trace.cacheControl) headerCoverage.cacheControl += 1;
    if (trace.link) headerCoverage.link += 1;
    if (Array.isArray(row?.earlyHints) && row.earlyHints.length) headerCoverage.earlyHints += 1;
    if (trace.age) headerCoverage.age += 1;
    if (trace.date) headerCoverage.date += 1;
    if (!trace.colo) continue;
    const cacheStatus = trace.cacheStatus || "missing";
    byColo[trace.colo] ??= { count: 0, cacheStatus: {} };
    byColo[trace.colo].count += 1;
    byColo[trace.colo].cacheStatus[cacheStatus] = (byColo[trace.colo].cacheStatus[cacheStatus] ?? 0) + 1;
  }
  return { headerCoverage, byColo };
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

function cloudflareTraceMetadata(headers = {}) {
  const cfRay = headerValue(headers, 'cf-ray');
  const serverTimingHeader = headerValue(headers, 'server-timing');
  return {
    cfRay,
    colo: extractColo(cfRay),
    cacheStatus: headerValue(headers, 'cf-cache-status'),
    cacheControl: headerValue(headers, 'cache-control'),
    link: headerValue(headers, 'link'),
    age: headerValue(headers, 'age'),
    date: headerValue(headers, 'date'),
    serverTiming: parseServerTiming(serverTimingHeader),
  };
}

function normalizeFrameworks(frameworks) {
  if (Array.isArray(frameworks)) return frameworks;
  if (!frameworks) return [];
  return Object.entries(frameworks).map(([name, value]) => {
    if (typeof value === 'string') return { name, url: value };
    return { name, ...value };
  });
}

function scenarioContractForFramework(fw, scenarioName) {
  const explicit = fw?.scenarioContracts?.[scenarioName];
  if (!explicit || !explicit.renderMode || !explicit.initialData || !explicit.hydrationModel) {
    throw new Error(
      `scenarioContractForFramework: framework "${fw?.name ?? 'unknown'}" missing explicit contract for scenario "${scenarioName}". Resolve via run-v4.mjs (matrix benchmarkDefaults.scenarioContracts) or framework override.`
    );
  }
  return { ...explicit };
}

export function scenarioContractBucketKey({ delivery, implementationKind, tier, cloudflareMode, scenario, contract }) {
  if (!cloudflareMode || cloudflareMode === 'unknown') {
    throw new Error(
      `scenarioContractBucketKey: cloudflareMode is required for scenario "${scenario}"; got ${JSON.stringify(cloudflareMode)}. The cloudflare audit row is missing or its wrangler config could not be parsed — fix the underlying wrangler.jsonc/wrangler.toml before running.`
    );
  }
  return [
    `delivery=${delivery || 'unknown'}`,
    `impl=${implementationKind || 'unknown'}`,
    `tier=${tier || 'unknown'}`,
    `cf=${cloudflareMode}`,
    `scenario=${scenario}`,
    `render=${contract.renderMode || 'unknown'}`,
    `data=${contract.initialData || 'unknown'}`,
    `hydration=${contract.hydrationModel || 'unknown'}`,
  ].join('::');
}

export function frameworkBucketKey(meta, scenarioNames) {
  const name = meta?.name ?? 'unknown';
  const cloudflareMode = meta?.cloudflare?.wrangler?.assetRouting?.mode;
  if (!cloudflareMode) {
    const detail = meta?.cloudflare
      ? meta.cloudflare.wrangler
        ? 'wrangler.assetRouting.mode is unset'
        : 'no wrangler config parsed (missing wrangler.jsonc/wrangler.toml or unreadable file)'
      : 'no cloudflare audit row (framework absent from cloudflare-config-audit output)';
    throw new Error(
      `frameworkBucketKey: framework "${name}" cloudflare audit row is unusable — ${detail}. Fix the underlying wrangler config before running.`
    );
  }
  const delivery = meta?.delivery ?? 'unknown';
  const implementationKind = meta?.implementationKind ?? 'unknown';
  const tier = meta?.tier ?? 'unknown';
  const segments = [
    `delivery=${delivery}`,
    `impl=${implementationKind}`,
    `tier=${tier}`,
    `cf=${cloudflareMode}`,
  ];
  for (const scenarioName of scenarioNames) {
    const contract = scenarioContractForFramework(meta, scenarioName);
    segments.push(
      `${scenarioName}[render=${contract.renderMode || 'unknown'},data=${contract.initialData || 'unknown'},hydration=${contract.hydrationModel || 'unknown'}]`
    );
  }
  return segments.join('::');
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
    const earlyHints = [];
    try {
      await client.send('Network.enable');
      client.on('Network.responseReceivedExtraInfo', (params) => {
        const statusCode = Number(params?.statusCode);
        if (statusCode !== 103) return;
        const headers = params?.headers ?? {};
        earlyHints.push({
          status: statusCode,
          requestId: params?.requestId ?? null,
          link: headerValue(headers, 'link'),
        });
      });
    } catch {
      // CDP network events are provenance-only; keep the benchmark running if
      // the browser build does not expose them.
    }
    return { client, baseline, earlyHints };
  } catch {
    return null;
  }
}

function earlyHintsForCdp(cdp) {
  return Array.isArray(cdp?.earlyHints)
    ? cdp.earlyHints.filter((item) => item?.status === 103)
    : [];
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

function buildFlamegraphFileName(row) {
  const framework = sanitizePathToken(row.framework);
  const profile = sanitizePathToken(row.profile);
  const scenario = sanitizePathToken(row.scenario);
  const phase = sanitizePathToken(row.phase);
  const iteration = Number.isFinite(row.iteration) ? String(row.iteration).padStart(2, '0') : '00';
  return `${framework}.${profile}.${scenario}.${phase}.iter${iteration}.cpuprofile`;
}

function isFlamegraphEnabledForRow(flamegraphs, row) {
  if (!flamegraphs?.enabled) return false;
  if (flamegraphs.frameworks && !flamegraphs.frameworks.has(row.framework)) return false;
  if (flamegraphs.profiles && !flamegraphs.profiles.has(row.profile)) return false;
  if (flamegraphs.scenarios && !flamegraphs.scenarios.has(row.scenario)) return false;
  if (flamegraphs.phases && !flamegraphs.phases.has(row.phase)) return false;
  if (Number.isFinite(flamegraphs.maxIteration) && row.iteration > flamegraphs.maxIteration) return false;
  return true;
}

function summarizeCpuProfile(profile, sampleIntervalUs = 100) {
  const nodes = Array.isArray(profile?.nodes) ? profile.nodes : [];
  if (!nodes.length) {
    return {
      sampleCount: 0,
      totalDurationMs: 0,
      topFrames: [],
    };
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const samples = Array.isArray(profile?.samples) ? profile.samples : [];
  const timeDeltas = Array.isArray(profile?.timeDeltas) ? profile.timeDeltas : [];
  const fallbackDeltaUs = Number.isFinite(sampleIntervalUs) ? sampleIntervalUs : 100;
  const selfTimeByNode = new Map();
  let totalUs = 0;

  for (let i = 0; i < samples.length; i++) {
    const nodeId = samples[i];
    if (!Number.isFinite(nodeId)) continue;
    const deltaUs = Number.isFinite(timeDeltas[i]) ? timeDeltas[i] : fallbackDeltaUs;
    totalUs += deltaUs;
    selfTimeByNode.set(nodeId, (selfTimeByNode.get(nodeId) || 0) + deltaUs);
  }

  const topFrames = [...selfTimeByNode.entries()]
    .map(([nodeId, selfUs]) => {
      const node = nodeById.get(nodeId);
      const frame = node?.callFrame || {};
      const functionName = frame.functionName || '(anonymous)';
      const script = frame.url || frame.scriptId || 'inline';
      const line = Number.isFinite(frame.lineNumber) ? frame.lineNumber + 1 : null;
      const column = Number.isFinite(frame.columnNumber) ? frame.columnNumber + 1 : null;
      return {
        functionName,
        script,
        line,
        column,
        selfMs: selfUs / 1000,
        selfPct: totalUs > 0 ? (selfUs / totalUs) * 100 : 0,
      };
    })
    .sort((a, b) => b.selfMs - a.selfMs)
    .slice(0, 10);

  return {
    sampleCount: samples.length,
    totalDurationMs: totalUs / 1000,
    topFrames,
  };
}

async function startCpuProfiler(page, sampleIntervalUs) {
  const client = await page.context().newCDPSession(page);
  await client.send('Profiler.enable');
  if (Number.isFinite(sampleIntervalUs)) {
    await client.send('Profiler.setSamplingInterval', { interval: sampleIntervalUs });
  }
  await client.send('Profiler.start');
  return { client };
}

async function stopCpuProfiler(profiler, writePath, sampleIntervalUs = 100) {
  if (!profiler?.client) return null;
  try {
    const stopped = await profiler.client.send('Profiler.stop');
    const profile = stopped?.profile || null;
    if (!profile) return null;
    await fs.writeFile(writePath, JSON.stringify(profile));
    const summary = summarizeCpuProfile(profile, sampleIntervalUs);
    return {
      path: writePath,
      format: 'cpuprofile',
      ...summary,
    };
  } finally {
    try {
      await profiler.client.detach();
    } catch {
      // ignore
    }
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

async function journeyInteractions(page, timeoutScale = 1) {
  const waitMs = 8000 * timeoutScale;
  await page.waitForSelector('[data-testid="stay-hero-image"]', { timeout: waitMs });

  // Hifi journey step 3: gallery photo click. Force-click the second photo to
  // generate a real interaction event. Lazy-loaded photos may not be loaded
  // yet, so click is "force" to avoid Playwright's intersection check.
  const galleryImgs = page.locator('[data-testid="stay-gallery"] img');
  const galleryCount = await galleryImgs.count();
  if (galleryCount >= 2) {
    try {
      await galleryImgs.nth(1).click({ timeout: waitMs, force: true });
    } catch {
      // Gallery click is best-effort; INP capture continues with the form step.
    }
    await page.waitForTimeout(TIMING.CONTROL_CHANGE_MS * timeoutScale);
  }

  // Hifi journey step 4: booking form fill + submit + wait for total.
  const form = page.locator('[data-testid="stay-booking-form"]').first();
  if (await form.count()) {
    const checkin = form.locator('input[name="checkin"]').first();
    if (await checkin.count()) {
      try {
        await checkin.fill('2026-06-15', { timeout: waitMs });
        await checkin.blur();
      } catch {}
    }
    const checkout = form.locator('input[name="checkout"]').first();
    if (await checkout.count()) {
      try {
        await checkout.fill('2026-06-18', { timeout: waitMs });
      } catch {}
    }
    const submitBtn = form.locator('button[type="submit"]').first();
    try {
      if (await submitBtn.count()) {
        await submitBtn.click({ timeout: waitMs });
      } else {
        await form.locator('input').first().press('Enter');
      }
    } catch {}
    try {
      await page.waitForSelector('[data-testid="stay-booking-total"]', { timeout: waitMs });
    } catch {
      // Booking total wait is best-effort; metric collection still proceeds.
    }
    await page.waitForTimeout(TIMING.CONTROL_CHANGE_MS * timeoutScale);
  }
}

async function mediaInteractions(page, timeoutScale = 1) {
  const waitMs = 8000 * timeoutScale;
  await page.waitForSelector('[data-testid="media-card"]', { timeout: waitMs });

  // Open first media card and wait for player region.
  await page.click('[data-testid="media-card"]');
  await page.waitForSelector('[data-testid="media-player"]', { timeout: waitMs });
  await page.waitForTimeout(TIMING.CONTROL_CHANGE_MS * timeoutScale);

  // Advance once to trigger "next" interaction marker when available.
  const nextButton = page.locator('[data-testid="media-next"]');
  if (await nextButton.count()) {
    await nextButton.first().click();
    await page.waitForTimeout(TIMING.CONTROL_CHANGE_MS * timeoutScale);
  }

  try {
    await page.waitForFunction(() => globalThis.__CF_BENCH__?.media?.ready === true, { timeout: waitMs });
  } catch {
    // Media marker is best effort; selector-based waits are authoritative.
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
    const trace = cloudflareTraceMetadata(headers);
    return {
      ok: res.ok(),
      status: res.status(),
      data,
      trace,
      headers: {
        'server-timing': headerValue(headers, 'server-timing'),
        serverTiming: trace.serverTiming,
        'cf-cache-status': headerValue(headers, 'cf-cache-status'),
        'cf-ray': headerValue(headers, 'cf-ray'),
        'cache-control': headerValue(headers, 'cache-control'),
        link: headerValue(headers, 'link'),
        date: headerValue(headers, 'date'),
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

async function runScenario(
  page,
  fw,
  sc,
  iteration,
  phase,
  bundleSizes,
  profile,
  throttling,
  timeoutScale,
  throttleApplied,
  flamegraphs
) {
  const scenarioContract = scenarioContractForFramework(fw, sc.name);
  const frameworkMeta = {
    delivery: fw.delivery ?? null,
    implementationKind: fw.implementationKind ?? null,
    tier: fw.tier ?? null,
    scenarioContracts: fw.scenarioContracts ?? null,
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
    scenarioContract,
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
  let profiler = null;
  let flamegraphFilePath = null;

  if (sc.requiresFeature && !fw.features?.[sc.requiresFeature]) {
    return { ...base, ok: false, skipped: true, error: `missing_feature:${sc.requiresFeature}` };
  }

  const run = async () => {
    let result = null;
    try {
      cdp = await startCdpMetrics(page);
      if (isFlamegraphEnabledForRow(flamegraphs, base)) {
        flamegraphFilePath = path.join(flamegraphs.outputDirAbs, buildFlamegraphFileName(base));
        profiler = await startCpuProfiler(page, flamegraphs.sampleIntervalUs);
      }

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
        const trace = cloudflareTraceMetadata(headers);
        const serverTiming = trace.serverTiming;
        const serverMetrics = {
          ttfb: data.synthetic?.nav?.ttfb ?? null,
          serverTiming,
        };
        result = {
          ...base,
          ok: true,
          status,
          navAttempts,
          clientNavMs: end - start,
          trace,
          earlyHints: earlyHintsForCdp(cdp),
          headers: {
            'server-timing': headerValue(headers, 'server-timing'),
            serverTiming,
            'cf-cache-status': headerValue(headers, 'cf-cache-status'),
            'cf-ray': headerValue(headers, 'cf-ray'),
            'cache-control': headerValue(headers, 'cache-control'),
            link: headerValue(headers, 'link'),
            age: headerValue(headers, 'age'),
            date: headerValue(headers, 'date'),
          },
          serverMetrics,
          ...data,
        };
        return result;
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
        await waitForHydration(page, TIMING.HYDRATION_MAX_WAIT_MS * timeoutScale);
        if (sc.interactType === 'media' || sc.name === 'media') {
          await mediaInteractions(page, timeoutScale);
        } else if (sc.interactType === 'journey') {
          await journeyInteractions(page, timeoutScale);
        } else {
          await chartInteractions(page, timeoutScale);
        }
        await waitForInp(page, TIMING.INP_SETTLE_MS * timeoutScale);
      }
      const data = await collect(page, { timeoutScale, cdp });
      if (sc.name === 'chart' && data.synthetic?.app?.chart?.error) {
        const message = data.synthetic?.app?.chart?.errorMessage || 'chart_error';
        throw new Error(`chart_error:${message}`);
      }
      const headers = res ? res.headers() : {};
      const trace = cloudflareTraceMetadata(headers);
      const serverTiming = trace.serverTiming;
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

      result = {
        ...base,
        ok: true,
        status,
        navAttempts,
        trace,
        earlyHints: earlyHintsForCdp(cdp),
        headers: {
          'server-timing': headerValue(headers, 'server-timing'),
          serverTiming,
          'cf-cache-status': headerValue(headers, 'cf-cache-status'),
          'cf-ray': headerValue(headers, 'cf-ray'),
          'cache-control': headerValue(headers, 'cache-control'),
          link: headerValue(headers, 'link'),
          age: headerValue(headers, 'age'),
          date: headerValue(headers, 'date'),
        },
        serverMetrics,
        ...data,
      };
      return result;
    } catch (err) {
      const errStatus = typeof err?.status === 'number' ? err.status : status;
      result = { ...base, ok: false, status: errStatus ?? null, navAttempts, error: errorToString(err) };
      return result;
    } finally {
      if (profiler && flamegraphFilePath) {
        try {
          const captured = await stopCpuProfiler(profiler, flamegraphFilePath, flamegraphs?.sampleIntervalUs);
          if (captured && result) {
            result.flamegraph = {
              ...captured,
              path: path.relative(REPO_ROOT, captured.path),
            };
          }
        } catch (profilerErr) {
          console.warn(`  ⚠️  CPU profiler stop failed: ${errorToString(profilerErr)}`);
        }
      }
      await endCdpMetrics(cdp);
    }
  };

  try {
    return await withTimeout(run(), hardTimeout, 'scenario');
  } catch (err) {
    return { ...base, ok: false, status: status ?? null, navAttempts, error: errorToString(err) };
  }
}

async function captureBundleSizes(browser, fw, scenarios, throttling, timeoutScale, benchHeaders, deviceContext, bundleSizes) {
  // Bundle Sizes capture must run BEFORE warmupFramework: Resource Timing
  // transferSize is 0 on cache hits, and warmupFramework primes the HTTP
  // cache for every route. A dedicated cold context per framework keeps
  // chart-route resources uncached so transferSize reflects real bytes.
  const chartScenario = scenarios.find((s) => s.name === 'chart');
  if (!chartScenario) {
    return; // Suite has no chart scenario; downstream scoring null-routes via measured=false.
  }
  const ctx = await browser.newContext({ ...(deviceContext || { viewport: VIEWPORT }), extraHTTPHeaders: benchHeaders || undefined });
  const page = await ctx.newPage();
  if (throttling) {
    await applyThrottling(page, throttling);
  }
  try {
    await page.goto(fw.url + chartScenario.path, { waitUntil: 'load', timeout: 15000 * timeoutScale });
    const resources = await page.evaluate(() => {
      const list = performance.getEntriesByType('resource') || [];
      const out = { js: 0, css: 0, total: 0 };
      for (const r of list) {
        const t = r.transferSize || 0;
        out.total += t;
        const name = r.name || '';
        if (name.endsWith('.js') || name.includes('.js?')) out.js += t;
        else if (name.endsWith('.css') || name.includes('.css?')) out.css += t;
      }
      return out;
    });
    bundleSizes[fw.name].js = resources.js;
    bundleSizes[fw.name].css = resources.css;
    bundleSizes[fw.name].total = resources.total;
    bundleSizes[fw.name].measured = true;
  } catch (e) {
    console.log(`  ⚠️  Bundle size capture failed for ${fw.name}: ${e.message}`);
  } finally {
    await ctx.close();
  }
}

async function warmupFramework(browser, fw, initScript, scenarios, throttling, timeoutScale, benchHeaders, deviceContext) {
  console.log(`  ⏳ Warming up ${fw.name}...`);
  const ctx = await browser.newContext({ ...(deviceContext || { viewport: VIEWPORT }), extraHTTPHeaders: benchHeaders || undefined });
  await ctx.addInitScript({ content: initScript });
  const page = await ctx.newPage();
  if (throttling) {
    await applyThrottling(page, throttling);
  }

  try {
    // Hit all routes once to warm up isolates. For client-nav scenarios warm both the
    // origin and destination URLs so warm-phase iterations don't hit a cold destination.
    const seen = new Set();
    for (const sc of scenarios) {
      const warmPaths = [sc.path, sc.clientNav?.from, sc.clientNav?.to].filter(Boolean);
      for (const warmPath of warmPaths) {
        if (seen.has(warmPath)) continue;
        seen.add(warmPath);
        await page.goto(fw.url + warmPath, { waitUntil: 'load', timeout: 15000 * timeoutScale });
        await page.waitForTimeout(TIMING.WARMUP_SETTLE_MS);
      }
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
  const configPath = arg('--config', null);
  if (!configPath) {
    throw new Error('Missing --config. Use bench/src/run-v4.mjs for standard v4 runs.');
  }
  const outPath = arg('--out', DEFAULT_OUT.pathname);
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const configIterations = Number(config.iterations ?? 5);
  const iterations = Number(arg('--iterations', String(configIterations)));
  const headless = !flag('--headed');
  const skipWarmup = flag('--skip-warmup');
  const warmupEnabled = skipWarmup ? false : Boolean(config.warmup ?? true);
  if (!Array.isArray(config.scenarios) || !config.scenarios.length) {
    throw new Error(`bench config at ${configPath} must declare a non-empty scenarios array. Suite-defined scenarios are the single source of authority; the runner no longer ships defaults.`);
  }
  const scenarios = config.scenarios;
  const frameworks = normalizeFrameworks(config.frameworks);
  const profileArg = arg('--profile', null);
  const iterationsArg = arg('--iterations', null);
  const seedArg = arg('--seed', config.seed || null);
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
  const rawFlamegraphConfig = config.flamegraphs || {};
  const flamegraphsEnabled = flag('--flamegraphs') || Boolean(rawFlamegraphConfig.enabled);
  const flamegraphDirArg = arg('--flamegraph-dir', null);
  const flamegraphSampleIntervalArg = arg('--flamegraph-sample-interval', null);
  const flamegraphFrameworksArg = arg('--flamegraph-frameworks', null);
  const flamegraphProfilesArg = arg('--flamegraph-profiles', null);
  const flamegraphScenariosArg = arg('--flamegraph-scenarios', null);
  const flamegraphPhasesArg = arg('--flamegraph-phases', null);
  const flamegraphMaxIterationArg = arg('--flamegraph-max-iteration', null);
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
  const runSeed = seedArg || sha256({
    runStartedAt,
    configPath,
    outPath,
    frameworks: frameworks.map((fw) => fw.name),
    scenarios: scenarios.map((sc) => sc.name),
    profiles,
  }).slice(0, 16);
  const runOrder = {
    randomization: 'seeded-shuffle',
    seed: runSeed,
    order: ['profile', 'shuffled(framework,scenario,iteration)', 'phase'],
    phaseOrder: ['cold', 'warm'],
    scenarioOrder: scenarios.map((sc) => sc.name),
    frameworkOrder: frameworks.map((fw) => fw.name),
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
  const frameworkVersions = pickFrameworkVersions(frameworks, frameworkPackages);
  const datasetInfo = await collectDatasetInfo();
  const cloudflarePlatform = await collectCloudflarePlatformEras();
  const gitInfo = getGitInfo();
  const allowDirtyProvenance = flag('--allow-dirty-provenance');
  const provenanceGate = assertCanonicalResultWritable({ outPath, gitInfo, allowDirtyProvenance });
  if (provenanceGate.dirtyCanonicalOverride) {
    console.warn('\nWARNING: Writing canonical results with dirty working tree (--allow-dirty-provenance set).');
  }
  const flamegraphDefaultScenarios = scenarios
    .map((sc) => sc.name)
    .filter((name) => name === 'chart' || name === 'media');
  const flamegraphOutputDirRelative = flamegraphDirArg
    || rawFlamegraphConfig.outputDir
    || path.join('bench', 'flamegraphs', runStartedAt.replace(/[:.]/g, '-'));
  const flamegraphOutputDirAbs = path.isAbsolute(flamegraphOutputDirRelative)
    ? flamegraphOutputDirRelative
    : path.resolve(REPO_ROOT, flamegraphOutputDirRelative);
  const flamegraphSampleIntervalUs =
    Number(flamegraphSampleIntervalArg ?? rawFlamegraphConfig.sampleIntervalUs ?? 100);
  const flamegraphMaxIteration =
    Number(flamegraphMaxIterationArg ?? rawFlamegraphConfig.maxIteration ?? 1);
  const flamegraphs = {
    enabled: flamegraphsEnabled,
    outputDirAbs: flamegraphOutputDirAbs,
    outputDirRelative: path.relative(REPO_ROOT, flamegraphOutputDirAbs),
    sampleIntervalUs: Number.isFinite(flamegraphSampleIntervalUs) ? flamegraphSampleIntervalUs : 100,
    maxIteration: Number.isFinite(flamegraphMaxIteration) ? flamegraphMaxIteration : 1,
    frameworks: parseCsvSet(flamegraphFrameworksArg ?? rawFlamegraphConfig.frameworks),
    profiles: parseCsvSet(flamegraphProfilesArg ?? rawFlamegraphConfig.profiles),
    scenarios: parseCsvSet(
      flamegraphScenariosArg
      ?? rawFlamegraphConfig.scenarios
      ?? flamegraphDefaultScenarios.join(',')
    ),
    phases: parseCsvSet(flamegraphPhasesArg ?? rawFlamegraphConfig.phases ?? 'cold'),
  };
  if (!flamegraphs.frameworks.size) flamegraphs.frameworks = null;
  if (!flamegraphs.profiles.size) flamegraphs.profiles = null;
  if (!flamegraphs.scenarios.size) flamegraphs.scenarios = null;
  if (!flamegraphs.phases.size) flamegraphs.phases = null;
  if (flamegraphs.enabled) {
    await fs.mkdir(flamegraphs.outputDirAbs, { recursive: true });
  }

  console.log(`\n🚀 Cloudflare Framework Benchmark`);
  console.log(`   Iterations: ${iterationsLabel}`);
  console.log(`   Warmup: ${warmupLabel}`);
  console.log(`   Frameworks: ${frameworks.length}`);
  console.log(`   Profiles: ${profiles.join(', ')}`);
  if (flamegraphs.enabled) {
    console.log(`   Flamegraphs: on (${flamegraphs.outputDirRelative})`);
  }

  const webVitalsSrc = await loadWebVitalsScript();

  const realDeviceTarget = arg('--realdevice', null);
  const browser = realDeviceTarget
    ? await connectRealDevice(realDeviceTarget)
    : await chromium.launch({ headless });
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
    const deviceContext = resolveDeviceContext(profileSettings[profile]);

    const profileIterations = iterationsByProfile[profile] ?? iterations;
    const profileWarmup = warmupByProfile[profile] ?? warmupEnabled;
    const deviceLabel = profileSettings[profile]?.device || 'default';
    console.log(
      `\n🧪 Profile: ${profile} (chartCache=${benchConfig.chartCache || 'default'}, device=${deviceLabel}, warmup=${profileWarmup ? 'on' : 'off'}, iterations=${profileIterations})`
    );
    const throttling = throttlingByProfile[profile] || null;
    const timeoutScale = timeoutScaleByProfile[profile] || 1;

    for (const fw of shuffled(frameworks, `${runSeed}:${profile}:warmup`)) {
      bundleSizes[fw.name] = { js: 0, css: 0, total: 0, measured: false };
      // Size capture runs in a fresh, no-warmup context so transferSize reflects
      // real bytes. The chart-cold-iter-0 fallback at the runScenario site stays
      // in place but becomes a no-op once measured=true.
      await captureBundleSizes(browser, fw, scenarios, throttling, timeoutScale, benchHeaders, deviceContext, bundleSizes);
      if (profileWarmup) {
        console.log(`\n▶ ${fw.name} (${fw.url})`);
        await warmupFramework(browser, fw, initScript, scenarios, throttling, timeoutScale, benchHeaders, deviceContext);
      }
    }

    const runUnits = [];
    for (const fw of frameworks) {
      for (const sc of scenarios) {
        for (let i = 0; i < profileIterations; i += 1) {
          runUnits.push({ fw, sc, iteration: i });
        }
      }
    }

    const orderedUnits = shuffled(runUnits, `${runSeed}:${profile}:units`);
    runOrder[profile] = orderedUnits.map((unit) => ({
      framework: unit.fw.name,
      scenario: unit.sc.name,
      iteration: unit.iteration + 1,
    }));

    for (const unit of orderedUnits) {
      const { fw, sc, iteration: i } = unit;
      console.log(`\n▶ ${fw.name} (${fw.url}) · ${sc.name} [${i + 1}/${profileIterations}]`);

      const ctx = await browser.newContext({ ...deviceContext, extraHTTPHeaders: benchHeaders });
      try {
        await ctx.addInitScript({ content: initScript });
        const page = await ctx.newPage();
        const throttleApplied = await applyThrottling(page, throttling);

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
          throttleApplied,
          flamegraphs
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
            throttleApplied,
            flamegraphs
          );
          all.push(warm);
          recordFailure(warm);
        }

        const coldTtfb = cold.synthetic?.nav?.ttfb?.toFixed?.(1) ?? '—';
        const coldLcp = cold.synthetic?.cwv?.lcp?.value?.toFixed?.(1) ?? '—';
        const coldTbt = cold.synthetic?.longTasks?.tbt?.toFixed?.(1) ?? '—';
        const warmTtfb = warm?.synthetic?.nav?.ttfb?.toFixed?.(1) ?? '—';
        const warmLcp = warm?.synthetic?.cwv?.lcp?.value?.toFixed?.(1) ?? '—';
        const warmTbt = warm?.synthetic?.longTasks?.tbt?.toFixed?.(1) ?? '—';
        const js = formatBytes(cold.synthetic?.resources?.js || 0);
        console.log(
          `  cold: ttfb=${coldTtfb}ms lcp=${coldLcp}ms tbt=${coldTbt}ms js=${js}` +
            (warm ? ` · warm: ttfb=${warmTtfb}ms lcp=${warmLcp}ms tbt=${warmTbt}ms` : '')
        );
      } finally {
        await ctx.close();
      }
    }
  }

  await browser.close();

  for (const row of all) {
    row.provenanceHash = provenanceHashForRow(row, gitInfo, runSeed);
  }

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
  const scenarioTypesByName = new Map(scenarios.map((sc) => [sc.name, sc.type]));

  const summary = [];
  for (const [key, rows] of byKey.entries()) {
    const [framework, profile, phase, scenario] = key.split('::');
    const meta = frameworkMetaByName.get(framework) || {};
    const delivery = meta.delivery ?? 'unknown';
    const implementationKind = meta.implementationKind ?? 'unknown';
    const scenarioType = rows[0]?.scenarioType ?? scenarioTypesByName.get(scenario);
    const scenarioContract = scenarioContractForFramework(meta, scenario);
    const bucketKeyScenario = scenarioContractBucketKey({
      delivery,
      implementationKind,
      tier: meta?.tier ?? 'unknown',
      cloudflareMode: meta?.cloudflare?.wrangler?.assetRouting?.mode ?? null,
      scenario,
      contract: scenarioContract,
    });
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
      scenarioType,
      implementationKind,
      scenarioContract,
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

  const scoringRubric = loadScoringRubric();
  const suiteId = path.basename(outPath).match(/^results\.v4\.([^.]+)/)?.[1] ?? null;
  if (!suiteId) {
    throw new Error(
      `bench runner: unable to derive suiteId from outPath ${outPath}; expected results.v4.<suite>.json. ` +
      `scenarioWeights are looked up per-suite in bench/scoring-rubric.json.`
    );
  }
  const scenarioWeights = scoringRubric.scenarioWeights[suiteId];
  if (!scenarioWeights) {
    throw new Error(
      `bench/scoring-rubric.json: missing scenarioWeights["${suiteId}"]. ` +
      `Every benchmark suite must declare per-scenario weights summing to 1.0.`
    );
  }
  for (const scenario of scenarioNames) {
    if (!Object.prototype.hasOwnProperty.call(scenarioWeights, scenario)) {
      throw new Error(
        `bench/scoring-rubric.json: scenarioWeights["${suiteId}"] missing scenario "${scenario}". ` +
        `Every scenario in the suite must have a declared weight (no fallback).`
      );
    }
  }

  const formatBucketKey = (key) => key.replace(/::/g, ' | ');

  const buckets = new Map();
  for (const name of frameworkNames) {
    const meta = frameworkMetaByName.get(name) || {};
    const key = frameworkBucketKey(meta, scenarioNames);
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
      const scWeight = scenarioWeights[scenario];
      const scRows = summary
        .filter((s) => s.profile === profile && s.phase === phase && s.scenario === scenario)
        .filter((s) => eligible.includes(s.framework));
      const interactionMs = (s) => {
        const values = [
          s.inp?.p50,
          s.chartSwitchMs?.p50,
          s.chartDrawMs?.p50,
        ].filter((v) => Number.isFinite(v));
        if (!values.length) return null;
        return values.reduce((sum, value) => sum + value, 0) / values.length;
      };
      const metrics = [
        { key: 'ttfb', get: (s) => s.ttfb.p50 },
        { key: 'lcp', get: (s) => s.lcp.p50 },
        { key: 'tbt', get: (s) => s.tbt.p50 },
        { key: 'interaction', get: interactionMs },
        { key: 'scriptBoot', get: (s) => s.scriptBootMs.p50 },
        // Skip unmeasured frameworks: an unset bundle would otherwise score as 0 bytes (best possible).
        { key: 'jsBytes', get: (s) => (bundleSizes[s.framework]?.measured ? bundleSizes[s.framework].js : null) },
        { key: 'heap', get: (s) => s.heapUsed.p50 },
      ];

      for (const m of metrics) {
        const values = scRows.map((s) => m.get(s)).filter((v) => Number.isFinite(v));
        if (!values.length) continue;
        const min = Math.min(...values);
        const max = Math.max(...values);
        if (min === max) continue;
        const weight = scWeight * effectiveMetricWeight(m.key, profile, scoringRubric);
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

    const isSolo = frameworksInBucket.length === 1;
    const rows = [...scores.entries()].map(([framework, data]) => ({
      framework,
      score: data.weight ? data.score / data.weight : null,
      ...(isSolo ? { solo: true } : {}),
    }));
    for (const fw of incomplete) {
      rows.push({
        framework: fw,
        score: null,
        incomplete: true,
        ...(isSolo ? { solo: true } : {}),
      });
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
            const js = bundleSizes[fw]?.measured ? formatBytes(bundleSizes[fw].js || 0) : '—';
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
  const traceCorrelation = summarizeTraceCorrelation(all);
  const cacheStatusSummary = summarizeHeaderValues(all, 'cf-cache-status');
  const cacheControlSummary = summarizeHeaderValues(all, 'cache-control');
  const linkHeaderSummary = summarizeHeaderValues(all, 'link');
  const serverTimingSummary = summarizeServerTiming(all);
  const flamegraphCaptures = all
    .filter((row) => row?.flamegraph?.path)
    .map((row) => ({
      framework: row.framework,
      profile: row.profile,
      phase: row.phase,
      scenario: row.scenario,
      iteration: row.iteration,
      path: row.flamegraph.path,
      sampleCount: row.flamegraph.sampleCount ?? 0,
      totalDurationMs: row.flamegraph.totalDurationMs ?? 0,
      topFrames: row.flamegraph.topFrames ?? [],
    }));
  const flamegraphHotspots = {};
  for (const capture of flamegraphCaptures) {
    const key = `${capture.framework}::${capture.profile}::${capture.phase}::${capture.scenario}`;
    const bucket = flamegraphHotspots[key] || {
      framework: capture.framework,
      profile: capture.profile,
      phase: capture.phase,
      scenario: capture.scenario,
      captures: 0,
      totalDurationMs: 0,
      frames: new Map(),
    };
    bucket.captures += 1;
    bucket.totalDurationMs += capture.totalDurationMs || 0;
    for (const frame of capture.topFrames || []) {
      const frameKey = `${frame.functionName}@@${frame.script}@@${frame.line ?? 0}`;
      const prev = bucket.frames.get(frameKey) || {
        functionName: frame.functionName,
        script: frame.script,
        line: frame.line,
        selfMs: 0,
      };
      prev.selfMs += frame.selfMs || 0;
      bucket.frames.set(frameKey, prev);
    }
    flamegraphHotspots[key] = bucket;
  }
  for (const key of Object.keys(flamegraphHotspots)) {
    const bucket = flamegraphHotspots[key];
    const topFrames = [...bucket.frames.values()]
      .sort((a, b) => b.selfMs - a.selfMs)
      .slice(0, 8);
    flamegraphHotspots[key] = {
      framework: bucket.framework,
      profile: bucket.profile,
      phase: bucket.phase,
      scenario: bucket.scenario,
      captures: bucket.captures,
      totalDurationMs: bucket.totalDurationMs,
      topFrames,
    };
  }

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
    seed: runSeed,
    profileArg,
    headless,
    skipWarmup,
    allowDirtyProvenance,
    flamegraphs: {
      enabled: flamegraphs.enabled,
      outputDir: flamegraphs.outputDirRelative,
      sampleIntervalUs: flamegraphs.sampleIntervalUs,
      maxIteration: flamegraphs.maxIteration,
      frameworks: flamegraphs.frameworks ? [...flamegraphs.frameworks] : null,
      profiles: flamegraphs.profiles ? [...flamegraphs.profiles] : null,
      scenarios: flamegraphs.scenarios ? [...flamegraphs.scenarios] : null,
      phases: flamegraphs.phases ? [...flamegraphs.phases] : null,
    },
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
  const cloudflareAudit = await buildCloudflareAudit({ cwd: REPO_ROOT });
  const cloudflareAuditStable = stableCloudflareAuditInput(cloudflareAudit);
  const cloudflareOptimizationAudit = await buildOptimizationAudit({ cwd: REPO_ROOT });
  const cloudflareOptimizationAuditStable = stableCloudflareOptimizationAuditInput(cloudflareOptimizationAudit);
  const provenance = {
    git: gitInfo,
    dataset: datasetInfo,
    hashes: {
      matrix: hashFile('bench/framework-matrix.json'),
      targets: hashFile(DEFAULT_TARGETS_PATH),
      lockfile: hashFile('pnpm-lock.yaml'),
      contract: benchmarkContractHash(),
      contractsJson: hashFile('contracts/v5.json'),
      scoring: scoringRubricHash(),
      suites: suitesHash(),
      cloudflarePlatform: hashFile(CLOUDFLARE_PLATFORM_ERAS_PATH),
      cloudflareConfig: sha256(cloudflareAuditStable),
      cloudflareOptimization: sha256(cloudflareOptimizationAuditStable),
    },
    cloudflarePlatform,
    cloudflareAudit: cloudflareAuditStable,
    cloudflareOptimizationAudit: cloudflareOptimizationAuditStable,
    frameworkPackages,
    frameworkVersions,
    benchApi: benchApiByFramework,
    scoring: {
      model: scoringRubric.model,
      modelChangedAt: scoringRubric.modelChangedAt ?? null,
      prevModel: scoringRubric.prevModel ?? null,
    },
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
    flamegraphs: {
      enabled: flamegraphs.enabled,
      outputDir: flamegraphs.outputDirRelative,
      sampleIntervalUs: flamegraphs.sampleIntervalUs,
      maxIteration: flamegraphs.maxIteration,
      filters: {
        frameworks: flamegraphs.frameworks ? [...flamegraphs.frameworks] : null,
        profiles: flamegraphs.profiles ? [...flamegraphs.profiles] : null,
        scenarios: flamegraphs.scenarios ? [...flamegraphs.scenarios] : null,
        phases: flamegraphs.phases ? [...flamegraphs.phases] : null,
      },
      captureCount: flamegraphCaptures.length,
      captures: flamegraphCaptures,
      hotspots: flamegraphHotspots,
    },
    edgeLocations,
    traceCorrelation,
    cacheStatusSummary,
    cacheControlSummary,
    linkHeaderSummary,
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
      implementationKind: fw.implementationKind ?? null,
      tier: fw.tier ?? null,
      scenarioContracts: fw.scenarioContracts ?? null,
      features: fw.features ?? null,
      deploy: fw.deploy ?? null,
    })),
    bundleSizes,
    failures,
    failureSummary: failureSummaryOut,
    scoring: scoringRubric,
    bucketScores,
    summary,
    rows: all
  };

  await fs.writeFile(outPath, JSON.stringify(out, null, 2));
  console.log(`\n✅ Results written to ${outPath}`);
  console.log(`Run duration: ${(durationMs / 1000).toFixed(1)}s`);

  // Also write a markdown summary
  const mdPath = outPath.replace(/\.json$/, '.md');
  const md = buildMarkdown(out, { iterationsArg, suiteId });
  await fs.writeFile(new URL(mdPath, 'file://'), md);
  console.log(`📝 Markdown summary written to ${mdPath}`);
}

function isMain() {
  return Boolean(process.argv[1]) && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isMain()) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
