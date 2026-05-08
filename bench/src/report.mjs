import fs from 'node:fs/promises';

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const rawIdx = Math.floor(Math.log(bytes) / Math.log(k));
  const i = Math.max(0, Math.min(sizes.length - 1, rawIdx));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatDuration(ms, digits = 1) {
  if (!Number.isFinite(ms)) return '—';
  if (ms < 1) return `${(ms * 1000).toFixed(0)}us`;
  return `${ms.toFixed(digits)}ms`;
}

export function deriveReportInputs(out) {
  const summary = Array.isArray(out?.summary) ? out.summary : [];
  const frameworkNames = [...new Set(summary.map((s) => s.framework))];
  const profileNames = Array.isArray(out?.profiles) && out.profiles.length
    ? out.profiles
    : [...new Set(summary.map((s) => s.profile))];
  const scenarioNames = [...new Set(
    summary.filter((s) => s.scenarioType !== 'client-nav').map((s) => s.scenario)
  )];
  const clientNavScenarios = [...new Set(
    summary.filter((s) => s.scenarioType === 'client-nav').map((s) => s.scenario)
  )];
  const phases = Array.isArray(out?.phases) && out.phases.length
    ? out.phases
    : [...new Set(summary.map((s) => s.phase))];
  const iterationsByProfile = out?.iterationsByProfile || {};
  const iterationsLabel = (() => {
    const values = profileNames.map((p) => iterationsByProfile[p]).filter((v) => Number.isFinite(v));
    const unique = [...new Set(values)];
    if (unique.length === 1) return String(unique[0]);
    return profileNames.map((p) => `${p}=${iterationsByProfile[p]}`).join(', ');
  })();
  const iterationsArg = out?.cli?.iterationsArg ?? null;
  const formatBucketKey = (key) => key.replace(/::/g, ' | ');
  const formatBucketKeyShort = (key) => {
    const parts = String(key).split('::');
    const out = [];
    for (const part of parts) {
      if (part.includes('[')) continue;
      const m = part.match(/^([\w-]+)=(.+)$/);
      if (!m) continue;
      const [, k, v] = m;
      if (k === 'delivery' || k === 'impl' || k === 'data' || k === 'scenario') continue;
      out.push(`${k}=${v}`);
    }
    return out.join(' · ');
  };
  return {
    frameworkNames,
    profileNames,
    scenarioNames,
    clientNavScenarios,
    phases,
    iterationsLabel,
    iterationsArg,
    formatBucketKey,
    formatBucketKeyShort,
  };
}

export function buildMarkdown(out, derived = {}) {
  if (!out || typeof out !== 'object') {
    throw new Error('buildMarkdown: expected JSON-shaped result object');
  }
  if (!Array.isArray(out.summary)) {
    throw new Error('buildMarkdown: out.summary missing or not an array');
  }
  if (!out.bucketScores || typeof out.bucketScores !== 'object') {
    throw new Error('buildMarkdown: out.bucketScores missing');
  }
  if (!out.scoring || typeof out.scoring !== 'object') {
    throw new Error('buildMarkdown: out.scoring missing');
  }

  const ctx = { ...deriveReportInputs(out), ...derived };
  const {
    frameworkNames,
    profileNames,
    scenarioNames,
    clientNavScenarios,
    phases,
    iterationsLabel,
    iterationsArg,
    formatBucketKey,
    formatBucketKeyShort,
    suiteId = null,
  } = ctx;

  const summary = out.summary;
  const provenance = out.provenance || {};
  const gitInfo = provenance.git || null;
  const datasetInfo = provenance.dataset || null;
  const frameworkVersions = provenance.frameworkVersions || {};
  const benchApiByFramework = provenance.benchApi || {};
  const frameworks = Array.isArray(out.frameworks) ? out.frameworks : [];
  const flamegraphs = out.flamegraphs || {};
  const flamegraphCaptures = Array.isArray(flamegraphs.captures) ? flamegraphs.captures : [];
  const flamegraphHotspots = flamegraphs.hotspots || {};
  const filters = flamegraphs.filters || {};
  const environment = out.environment || {};
  const systemInfo = environment;
  const browserEnv = environment.browserEnv || null;
  const browser = environment.browser || {};
  const playwright = environment.playwright || {};
  const viewport = environment.viewport || { width: 0, height: 0 };
  const headless = !!browser.headless;
  const browserVersion = browser.version || '';
  const playwrightVersion = playwright.version || '';
  const nodeVersion = environment.node?.version || '';
  const network = out.network || {};
  const cliThrottle = network.cliThrottle || null;
  const throttlingByProfile = network.throttlingByProfile || {};
  const config = out.config?.data || {};
  const configPath = out.config?.path || '';
  const cache = out.cache || {};
  const profileSettings = cache.profileSettings || {};
  const warmupPaths = Array.isArray(cache.warmupPaths) ? cache.warmupPaths : [];
  const warmupSettleMs = Number.isFinite(cache.warmupSettleMs) ? cache.warmupSettleMs : 0;
  const warmupByProfile = out.warmupByProfile || cache.warmupByProfile || {};
  const iterationsByProfile = out.iterationsByProfile || {};
  const warmupEnabled = !!out.warmupEnabled;
  const failures = Array.isArray(out.failures) ? out.failures : [];
  const runEndedAt = out.ts || '';
  const runStartedAt = out.runStartedAt || '';
  const durationMs = Number.isFinite(out.durationMs) ? out.durationMs : 0;
  const runOrder = out.runOrder || { order: [], randomization: '', seed: '' };
  const edgeLocations = out.edgeLocations || { distinct: [], byColo: {} };
  const traceCorrelation = out.traceCorrelation || { headerCoverage: {}, byColo: {} };
  const cacheStatusSummary = out.cacheStatusSummary || {};
  const cacheControlSummary = out.cacheControlSummary || {};
  const linkHeaderSummary = out.linkHeaderSummary || {};
  const serverTimingSummary = out.serverTimingSummary || {};
  const bundleSizes = out.bundleSizes || {};
  const scoringRubric = out.scoring;
  const metricWeights = scoringRubric.metricWeights || {};
  const scenarioWeights = scoringRubric.scenarioWeights || {};
  const bucketScores = out.bucketScores;

  let md = `# Framework Benchmark Results\n\n`;
  md += `Generated: ${runEndedAt}\n`;
  md += `Run started: ${runStartedAt}\n`;
  md += `Duration: ${(durationMs / 1000).toFixed(1)}s\n`;
  md += `Iterations: ${iterationsLabel}${iterationsArg ? ` (**overridden via --iterations ${iterationsArg}**)` : ''}\n`;
  md += `Warmup: ${warmupEnabled ? 'enabled' : 'disabled'}\n\n`;
  md += `Profiles: ${profileNames.join(', ')}\n\n`;
  md += `Failures: ${failures.length}\n\n`;

  md += `## Run Metadata\n\n`;
  md += `| Field | Value |\n`;
  md += `|------|-------|\n`;
  md += `| Headless | ${headless ? 'true' : 'false'} |\n`;
  md += `| Viewport | ${viewport.width}x${viewport.height} |\n`;
  md += `| Browser | Chromium ${browserVersion || '—'} |\n`;
  md += `| Playwright | ${playwrightVersion || '—'} |\n`;
  md += `| Node | ${nodeVersion} |\n`;
  md += `| OS | ${systemInfo.os.platform} ${systemInfo.os.release} (${systemInfo.os.arch}) |\n`;
  md += `| CPU | ${systemInfo.cpu.model || '—'} (${systemInfo.cpu.cores} cores) |\n`;
  md += `| RAM | ${formatBytes(systemInfo.memory.totalBytes)} |\n`;
  md += `| Timezone | ${browserEnv?.timeZone || '—'} |\n`;
  md += `| Locale | ${browserEnv?.language || '—'} |\n`;
  md += `| User agent | ${browserEnv?.userAgent || '—'} |\n`;
  md += `| Run order | ${runOrder.order.join(' -> ')} |\n`;
  md += `| Randomization | ${runOrder.randomization} |\n`;
  md += `| Randomization seed | ${runOrder.seed} |\n`;
  md += `| Flamegraphs enabled | ${flamegraphs.enabled ? 'true' : 'false'} |\n`;
  md += `| Flamegraph captures | ${flamegraphCaptures.length} |\n`;
  md += `| Flamegraph output dir | ${flamegraphs.enabled ? flamegraphs.outputDir : '—'} |\n\n`;

  md += `## Stable Findings\n\n`;
  md += `Frameworks where the leader's median is materially ahead of both the next-best and the cohort median within the same contract bucket. Lower is better. Gate: bucket has ≥3 frameworks, leader is ≥10% better than the cohort median AND ≥5% better than the next-best. Top 10 by Δ vs median.\n\n`;
  const stableInteractionMs = (s) => {
    const values = [s.inp?.p50, s.chartSwitchMs?.p50, s.chartDrawMs?.p50].filter((v) => Number.isFinite(v));
    if (!values.length) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  };
  const stableMetrics = [
    { key: 'lcp', get: (s) => s.lcp?.p50, fmt: (v) => `${v.toFixed(0)}ms` },
    { key: 'ttfb', get: (s) => s.ttfb?.p50, fmt: (v) => `${v.toFixed(0)}ms` },
    { key: 'tbt', get: (s) => s.tbt?.p50, fmt: (v) => `${v.toFixed(0)}ms` },
    { key: 'scriptBoot', get: (s) => s.scriptBootMs?.p50, fmt: (v) => `${v.toFixed(0)}ms` },
    { key: 'interaction', get: stableInteractionMs, fmt: (v) => `${v.toFixed(0)}ms` },
    { key: 'heap', get: (s) => s.heapUsed?.p50, fmt: formatBytes },
  ];
  const findings = [];
  const allScenarioNames = [...scenarioNames, ...clientNavScenarios];
  for (const profile of profileNames) {
    for (const phase of phases) {
      for (const scenario of allScenarioNames) {
        const rowsForScen = summary.filter((s) => s.profile === profile && s.phase === phase && s.scenario === scenario);
        const bucketsForScen = new Map();
        for (const row of rowsForScen) {
          const key = row.bucketKeyScenario || 'unknown';
          const list = bucketsForScen.get(key) || [];
          list.push(row);
          bucketsForScen.set(key, list);
        }
        for (const [, bucketRows] of bucketsForScen) {
          if (bucketRows.length < 3) continue;
          for (const m of stableMetrics) {
            const points = bucketRows
              .map((r) => ({ fw: r.framework, value: m.get(r) }))
              .filter((p) => Number.isFinite(p.value));
            if (points.length < 3) continue;
            points.sort((a, b) => a.value - b.value);
            const best = points[0];
            const others = points.slice(1).map((p) => p.value);
            const secondBest = others[0];
            const sortedOthers = [...others].sort((a, b) => a - b);
            const mid = Math.floor(sortedOthers.length / 2);
            const median = sortedOthers.length % 2 === 1
              ? sortedOthers[mid]
              : (sortedOthers[mid - 1] + sortedOthers[mid]) / 2;
            if (!(median > 0) || !(secondBest > 0)) continue;
            const dMedian = (median - best.value) / median;
            const dNext = (secondBest - best.value) / secondBest;
            if (dMedian >= 0.10 && dNext >= 0.05) {
              findings.push({
                profile, phase, scenario, metric: m.key,
                fw: best.fw, value: best.value, fmt: m.fmt,
                dNext, dMedian,
              });
            }
          }
        }
      }
    }
  }
  findings.sort((a, b) => b.dMedian - a.dMedian);
  md += `| Suite | Profile | Phase | Scenario | Metric | Best | Δ vs next | Δ vs median |\n`;
  md += `|-------|---------|-------|----------|--------|-----:|----------:|------------:|\n`;
  if (!findings.length) {
    md += `| ${suiteId || '—'} | — | — | — | — | — | — | — |\n`;
  } else {
    for (const f of findings.slice(0, 10)) {
      md += `| ${suiteId || '—'} | ${f.profile} | ${f.phase} | ${f.scenario} | ${f.metric} (${f.fw}) | ${f.fmt(f.value)} | ${(f.dNext * 100).toFixed(1)}% | ${(f.dMedian * 100).toFixed(1)}% |\n`;
    }
  }
  md += '\n';

  md += `## Scenarios\n\n`;
  md += `| Name | Type | Path | Wait for | Client nav |\n`;
  md += `|------|------|------|----------|------------|\n`;
  const scenarios = Array.isArray(out.scenarios) ? out.scenarios : [];
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
  const throttlingSummary = cliThrottle || config.throttling || 'none';
  const throttlingLabel = typeof throttlingSummary === 'string' ? throttlingSummary : JSON.stringify(throttlingSummary);
  md += `| Network throttling | ${throttlingLabel} (per profile) |\n`;
  md += `| CPU throttling | ${throttlingLabel} (per profile) |\n`;
  md += `| Warmup default | ${warmupEnabled ? 'enabled' : 'disabled'} |\n`;
  md += `| Warmup settle | ${warmupSettleMs}ms |\n`;
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
  md += `| Profile | Device | Warmup | Iterations |\n`;
  md += `|---------|--------|--------|-----------:|\n`;
  for (const p of profileNames) {
    const warm = warmupByProfile[p];
    const iter = iterationsByProfile[p];
    const dev = profileSettings[p]?.device || 'default';
    md += `| ${p} | ${dev} | ${warm ? 'enabled' : 'disabled'} | ${Number.isFinite(iter) ? iter : '—'} |\n`;
  }
  md += '\n';

  if (flamegraphs.enabled) {
    md += `## Flamegraphs\n\n`;
    md += `CPU profiles are captured as Chrome \`.cpuprofile\` artifacts and can be opened in speedscope or Chrome DevTools.\n\n`;
    md += `| Setting | Value |\n`;
    md += `|---------|-------|\n`;
    md += `| Output dir | ${flamegraphs.outputDir} |\n`;
    md += `| Sample interval | ${flamegraphs.sampleIntervalUs}us |\n`;
    md += `| Max iteration | ${flamegraphs.maxIteration} |\n`;
    md += `| Framework filter | ${filters.frameworks ? [...filters.frameworks].join(', ') : 'all'} |\n`;
    md += `| Profile filter | ${filters.profiles ? [...filters.profiles].join(', ') : 'all'} |\n`;
    md += `| Scenario filter | ${filters.scenarios ? [...filters.scenarios].join(', ') : 'all'} |\n`;
    md += `| Phase filter | ${filters.phases ? [...filters.phases].join(', ') : 'all'} |\n\n`;

    md += `### Captures\n\n`;
    md += `| Framework | Profile | Phase | Scenario | Iter | Samples | Duration | Artifact |\n`;
    md += `|-----------|---------|-------|----------|-----:|--------:|---------:|----------|\n`;
    if (flamegraphCaptures.length) {
      for (const capture of flamegraphCaptures) {
        md += `| ${capture.framework} | ${capture.profile} | ${capture.phase} | ${capture.scenario} | ${capture.iteration} | ${capture.sampleCount} | ${capture.totalDurationMs.toFixed(1)}ms | ${capture.path} |\n`;
      }
    } else {
      md += `| — | — | — | — | 0 | 0 | 0ms | — |\n`;
    }
    md += '\n';

    md += `### Hotspots\n\n`;
    md += `| Framework | Profile | Phase | Scenario | Captures | Top self-time frames |\n`;
    md += `|-----------|---------|-------|----------|---------:|----------------------|\n`;
    const hotspotRows = Object.values(flamegraphHotspots).sort((a, b) => {
      const aw = `${a.framework}:${a.profile}:${a.phase}:${a.scenario}`;
      const bw = `${b.framework}:${b.profile}:${b.phase}:${b.scenario}`;
      return aw.localeCompare(bw);
    });
    if (hotspotRows.length) {
      for (const hotspot of hotspotRows) {
        const topList = (hotspot.topFrames || [])
          .slice(0, 3)
          .map((frame) => `${frame.functionName} (${frame.selfMs.toFixed(1)}ms)`)
          .join('; ');
        md += `| ${hotspot.framework} | ${hotspot.profile} | ${hotspot.phase} | ${hotspot.scenario} | ${hotspot.captures} | ${topList || '—'} |\n`;
      }
    } else {
      md += `| — | — | — | — | 0 | — |\n`;
    }
    md += '\n';
  }

  md += `## Provenance\n\n`;
  md += `| Field | Value |\n`;
  md += `|------|-------|\n`;
  md += `| Git commit | ${gitInfo?.commit || '—'} |\n`;
  md += `| Git branch | ${gitInfo?.branch || '—'} |\n`;
  md += `| Git describe | ${gitInfo?.describe || '—'} |\n`;
  md += `| Git dirty | ${gitInfo ? (gitInfo.dirty ? '**true (NON-CANONICAL)**' : 'false') : '—'} |\n`;
  md += `| Iterations override | ${iterationsArg ? `**--iterations ${iterationsArg} (overrides profile defaults)**` : 'none'} |\n`;
  md += `| Matrix hash | ${provenance.hashes?.matrix || '—'} |\n`;
  md += `| Targets hash | ${provenance.hashes?.targets || '—'} |\n`;
  md += `| Contract hash | ${provenance.hashes?.contract || '—'} |\n`;
  md += `| Contracts JSON hash | ${provenance.hashes?.contractsJson || '—'} |\n`;
  md += `| Scoring rubric hash | ${provenance.hashes?.scoring || '—'} |\n`;
  md += `| Suites hash | ${provenance.hashes?.suites || '—'} |\n`;
  md += `| Cloudflare platform hash | ${provenance.hashes?.cloudflarePlatform || '—'} |\n`;
  md += `| Cloudflare platform era | ${provenance.cloudflarePlatform?.activeEra || '—'} |\n`;
  md += `| Cloudflare config hash | ${provenance.hashes?.cloudflareConfig || '—'} |\n`;
  md += `| Cloudflare optimization hash | ${provenance.hashes?.cloudflareOptimization || '—'} |\n`;
  md += `| Lockfile hash | ${provenance.hashes?.lockfile || '—'} |\n`;
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
  const benchApiTotal = frameworkNames.length;
  const benchApiOk = frameworkNames.filter((fw) => benchApiByFramework[fw]?.status === 200).length;
  const benchApiIsolates = new Set();
  const benchApiColos = {};
  for (const fw of frameworkNames) {
    const api = benchApiByFramework[fw];
    if (api?.data?.isolateId) benchApiIsolates.add(api.data.isolateId);
    const cfRay = api?.headers?.['cf-ray'];
    const colo = typeof cfRay === 'string' ? cfRay.split('-').pop() : null;
    if (colo) benchApiColos[colo] = (benchApiColos[colo] || 0) + 1;
  }
  const benchApiColoLabel = Object.entries(benchApiColos)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([c, n]) => `${c}=${n}`)
    .join(', ') || '—';
  md += `Bench API: ${benchApiOk}/${benchApiTotal} ok, ${benchApiIsolates.size} unique isolates, colos: ${benchApiColoLabel}\n\n`;

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

  md += `### Trace header coverage\n\n`;
  const coverage = traceCorrelation.headerCoverage || {};
  const coverageLabel = Object.entries(coverage)
    .map(([field, count]) => `${field}=${count}`)
    .join(' · ') || '—';
  md += `${coverageLabel}\n\n`;

  md += `### Cache status by colo\n\n`;
  md += `| Colo | Rows | Cache statuses |\n`;
  md += `|------|-----:|----------------|\n`;
  const traceColos = Object.entries(traceCorrelation.byColo).sort(([a], [b]) => a.localeCompare(b));
  if (traceColos.length) {
    for (const [colo, data] of traceColos) {
      const statuses = Object.entries(data.cacheStatus)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([status, count]) => `${status}=${count}`)
        .join(', ');
      md += `| ${colo} | ${data.count} | ${statuses || '—'} |\n`;
    }
  } else {
    md += `| — | 0 | — |\n`;
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

  md += `### Link headers\n\n`;
  md += `| Value | Count |\n`;
  md += `|-------|------:|\n`;
  const linkHeaderEntries = Object.entries(linkHeaderSummary).sort(([, a], [, b]) => b - a);
  if (linkHeaderEntries.length) {
    const top = linkHeaderEntries.slice(0, 5);
    for (const [val, count] of top) {
      md += `| ${val} | ${count} |\n`;
    }
    const tail = linkHeaderEntries.length - top.length;
    if (tail > 0) {
      md += `| (+${tail} more) | — |\n`;
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
  const cfgScenarioCount = Array.isArray(out.scenarios) ? out.scenarios.length : 0;
  const cfgThrottlingProfiles = Object.keys(config.throttlingProfiles || {}).join(', ') || '—';
  md += `| Field | Value |\n`;
  md += `|-------|-------|\n`;
  md += `| Iterations | ${iterationsLabel} |\n`;
  md += `| Warmup | ${warmupEnabled ? 'enabled' : 'disabled'} |\n`;
  md += `| Profiles | ${profileNames.join(', ')} |\n`;
  md += `| Scenarios | ${cfgScenarioCount} |\n`;
  md += `| Throttling profiles | ${cfgThrottlingProfiles} |\n\n`;
  md += `Full config retained in JSON at \`config.data\`${configPath ? ` (source: ${configPath})` : ''}.\n\n`;

  md += `## Bundle Sizes\n\n`;
  md += `| Framework | JS | CSS | Total |\n`;
  md += `|-----------|---:|----:|------:|\n`;
  for (const fw of frameworkNames) {
    const b = bundleSizes[fw];
    md += `| ${fw} | ${formatBytes(b?.js || 0)} | ${formatBytes(b?.css || 0)} | ${formatBytes(b?.total || 0)} |\n`;
  }

  md += `\n## Bucket Key Glossary\n\n`;
  md += `Bucket keys group results that are contract-comparable. Section headings show a short sigil (e.g. \`tier=framework-runtime · cf=worker-first · render=ssr · hydration=framework\`); the full key in the JSON adds \`delivery\` (Node/static/edge runtime class), \`impl\` (native/adapter/wrapper), and the per-scenario \`render\`/\`data\`/\`hydration\` triple. Segments:\n\n`;
  md += `- \`delivery\`: runtime class — workers, node, static, etc.\n`;
  md += `- \`impl\`: implementation kind — native, adapter, wrapper.\n`;
  md += `- \`tier\`: entry class per \`docs/contracts-v5.md\` (worker-baseline, framework-runtime, framework-prerender, …).\n`;
  md += `- \`cf\`: Cloudflare Static Assets routing mode (worker-only, worker-first, worker-first-for-contract-routes, …).\n`;
  md += `- \`render\` / \`data\` / \`hydration\`: per-scenario triple describing how the route is rendered, where data comes from, and how the page hydrates.\n\n`;

  md += `\n## Performance Metrics (p50 · p95)\n\n`;
  md += `Note: TTFB is server/network; LCP/TBT/CPU/Heap are client-side metrics. p95 in parentheses where n≥3.\n\n`;
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
          md += `##### ${scenario.charAt(0).toUpperCase() + scenario.slice(1)} — ${formatBucketKeyShort(bucketKey)}\n\n`;
          md += `| Framework | TTFB (server) | LCP (client) | TBT (client) | Script (client) | CPU (client) | Heap (client) |\n`;
          md += `|-----------|--------------:|-------------:|-------------:|---------------:|-------------:|--------------:|\n`;
          for (const s of bucketRows) {
            const showP95 = (s.ttfb.n ?? 0) >= 3;
            const fmt = (stat, unit = 'ms') => {
              if (stat?.p50 == null) return '—';
              return showP95 && stat.p95 != null
                ? `${stat.p50.toFixed(0)}${unit} (${stat.p95.toFixed(0)})`
                : `${stat.p50.toFixed(0)}${unit}`;
            };
            const fmtHeap = (stat) => {
              if (stat?.p50 == null) return '—';
              return showP95 && stat.p95 != null
                ? `${formatBytes(stat.p50)} (${formatBytes(stat.p95)})`
                : formatBytes(stat.p50);
            };
            md += `| ${s.framework} | ${fmt(s.ttfb)} | ${fmt(s.lcp)} | ${fmt(s.tbt)} | ${fmt(s.scriptBootMs)} | ${fmt(s.cpuTaskMs)} | ${fmtHeap(s.heapUsed)} |\n`;
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
            const s = summary.find((x) => x.framework === fw && x.profile === profile && x.scenario === scenario && x.phase === phase);
            if (!s) continue;
            md += `| ${fw} | ${s.clientNavMs.p50?.toFixed(0) ?? '—'}ms | ${formatBytes(s.heapUsed.p50 || 0)} |\n`;
          }
          md += '\n';
          md += `Sample counts:\n\n`;
          md += `| Framework | ok/expected | skipped | failed | Nav n | Heap n |\n`;
          md += `|-----------|------------:|--------:|-------:|------:|-------:|\n`;
          for (const fw of frameworkNames) {
            const s = summary.find((x) => x.framework === fw && x.profile === profile && x.scenario === scenario && x.phase === phase);
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
          md += `#### ${scenario.charAt(0).toUpperCase() + scenario.slice(1)} — ${formatBucketKeyShort(bucketKey)}\n\n`;
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
  md += `> **Scoring rubric (${scoringRubric.model})**: lower is better. Metrics are min-max normalized within each profile/phase/tier/contract bucket, then weighted as LCP ${metricWeights.lcp}, TBT ${metricWeights.tbt}, TTFB ${metricWeights.ttfb}, interaction ${metricWeights.interaction}, script boot ${metricWeights.scriptBoot}, JS transfer ${metricWeights.jsBytes}, heap ${metricWeights.heap}. Scenario mix is home ${scenarioWeights.home}, stays ${scenarioWeights.stays}, blog ${scenarioWeights.blog}, chart ${scenarioWeights.chart}, media ${scenarioWeights.media}. Missing metrics are omitted and observed weights are renormalized. Failed or incomplete framework/scenario runs are not ranked.\n\n`;
  for (const profile of profileNames) {
    md += `### Profile: ${profile}\n\n`;
    for (const phase of phases) {
      md += `#### ${phase.toUpperCase()}\n\n`;
      const byBucket = bucketScores[profile]?.[phase] || {};
      for (const [bucketKey, scored] of Object.entries(byBucket)) {
        if (!Array.isArray(scored) || !scored.length) continue;
        const bucketIsSolo = scored.length === 1;
        md += `##### Bucket: ${formatBucketKeyShort(bucketKey)}\n\n`;
        md += `| Framework | Score |\n`;
        md += `|-----------|------:|\n`;
        for (const row of scored) {
          let score;
          if (row.score == null) {
            if (row.incomplete) score = '— (incomplete)';
            else if (row.solo === true || bucketIsSolo) score = '— (solo: no peers in bucket)';
            else score = '—';
          } else {
            score = row.score.toFixed(3);
          }
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

  return md;
}

export async function writeMarkdown(jsonPath, mdPath = null) {
  const raw = await fs.readFile(jsonPath, 'utf8');
  const out = JSON.parse(raw);
  const md = buildMarkdown(out);
  const targetPath = mdPath || jsonPath.replace(/\.json$/, '.md');
  await fs.writeFile(targetPath, md);
  return { jsonPath, mdPath: targetPath };
}
