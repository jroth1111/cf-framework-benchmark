import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildCloudflareAudit } from '../../scripts/cloudflare-config-audit.mjs';
import {
  DEFAULT_MATRIX_PATH,
  DEFAULT_TARGETS_PATH,
  DEFAULT_SUITES_DIR,
  loadSuite,
  parseCsvSet,
  resolveLiveTargets,
  toAbsolutePath,
} from './config-v4.mjs';

const BENCH_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function argValue(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function mapScenario(sc) {
  const interactions = Array.isArray(sc.interactions) ? sc.interactions : [];
  const interactionKinds = new Set(
    interactions.map((item) => String(item?.kind || '').toLowerCase()).filter(Boolean)
  );
  const looksMedia =
    String(sc.name || '').toLowerCase().includes('media') ||
    [...interactionKinds].some((kind) => kind.startsWith('media'));

  const out = {
    name: sc.name,
    path: sc.path,
    type: sc.type === 'spa' ? 'spa' : 'document',
    waitFor: sc.waitFor || undefined,
    waitUntil: sc.waitUntil || (sc.type === 'spa' ? 'domcontentloaded' : 'load'),
  };

  if (interactions.length > 0) {
    out.interact = true;
    out.interactType = looksMedia ? 'media' : 'chart';
  }

  return out;
}

export function defaultScenarioContract(sc) {
  if (sc.type === 'spa') {
    return {
      renderMode: 'spa',
      initialData: 'client-fetch',
      hydrationModel: 'framework',
    };
  }
  return {
    renderMode: 'ssr',
    initialData: 'document',
    hydrationModel: 'framework',
  };
}

export function defaultOutPathForSuite(suiteName) {
  return path.join(BENCH_DIR, `results.v4.${suiteName}.json`);
}

async function runLegacyRunner({ configPath, outPath, passthroughArgs }) {
  const child = spawn('node', ['./src/run.mjs', '--config', configPath, '--out', outPath, ...passthroughArgs], {
    cwd: BENCH_DIR,
    stdio: 'inherit',
    env: process.env,
  });

  await new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`run.mjs exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

async function runContractReport({ tempDir, suiteName, targetsPath, matrixPath, suitesDir, only }) {
  const outPath = path.join(tempDir, `contract-report.${suiteName}.json`);
  const args = [
    '../scripts/contract-report.mjs',
    '--matrix',
    matrixPath,
    '--targets',
    targetsPath,
    '--suites-dir',
    suitesDir,
    '--suites',
    suiteName,
    '--out',
    outPath,
    '--fail-on-violations',
  ];
  if (only?.size) args.push('--only', [...only].join(','));

  const child = spawn('node', args, {
    cwd: BENCH_DIR,
    stdio: 'inherit',
    env: process.env,
  });

  await new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`contract-report failed with code ${code}; use --skip-contract-report only for diagnostic runs`));
    });
    child.on('error', reject);
  });

  return outPath;
}

async function main() {
  const suiteName = argValue('--suite', 'mpa_airbnb');
  const targetsPath = toAbsolutePath(argValue('--targets', null), DEFAULT_TARGETS_PATH);
  const matrixPath = toAbsolutePath(argValue('--matrix', null), DEFAULT_MATRIX_PATH);
  const suitesDir = toAbsolutePath(argValue('--suites-dir', null), DEFAULT_SUITES_DIR);
  const outPath = toAbsolutePath(argValue('--out', null), defaultOutPathForSuite(suiteName));
  const only = parseCsvSet(argValue('--only', ''));

  const [suite, targets] = await Promise.all([
    loadSuite(suiteName, suitesDir),
    resolveLiveTargets({
      matrixPath,
      targetsPath,
      only,
      requireWorkers: true,
      requireEnabled: true,
    }),
  ]);
  const cloudflareAudit = await buildCloudflareAudit({ cwd: path.resolve(BENCH_DIR, '..'), matrixPath });
  const cloudflareByName = new Map(cloudflareAudit.frameworks.map((row) => [row.name, row]));
  const scenarios = suite.scenarios.map(mapScenario);

  const frameworks = [];
  for (const target of targets) {
    const scenarioContracts = {};
    for (const sc of scenarios) {
      scenarioContracts[sc.name] = {
        ...defaultScenarioContract(sc),
        ...(target.matrix?.scenarioContracts?.[suiteName]?.[sc.name] || {}),
      };
    }

    frameworks.push({
      name: target.framework,
      url: target.url,
      delivery: 'workers',
      implementationKind: target.matrix?.implementationKind || 'native',
      tier: target.matrix?.tier || null,
      cloudflare: cloudflareByName.get(target.framework) ?? null,
      features: { clientNav: false },
      scenarioContracts,
      deploy: target.matrix?.deploy || null,
    });
  }

  if (!frameworks.length) {
    throw new Error('No benchmark-enabled frameworks resolved from targets + matrix.');
  }

  const profileArg = argValue('--profile', null);
  const profiles = profileArg
    ? (profileArg === 'both' ? ['parity', 'idiomatic'] : [profileArg])
    : ['parity', 'idiomatic', 'mobile-cold'];

  const config = {
    iterations: Number(argValue('--iterations', '10')),
    warmup: !hasFlag('--skip-warmup'),
    profiles,
    profileSettings: {
      parity: { chartCache: 'no-store', throttling: 'none' },
      idiomatic: { chartCache: 'default', throttling: 'none' },
      'mobile-cold': { chartCache: 'default', throttling: 'fast-4g', warmup: false, iterations: 10 },
    },
    throttlingProfiles: {
      none: { cpu: 1, network: 'none' },
      'fast-4g': { cpu: 2, network: 'fast-4g', timeoutScale: 2 },
      'slow-3g': { cpu: 4, network: 'slow-3g', timeoutScale: 3 },
    },
    throttling: 'none',
    frameworks,
    scenarios,
  };

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-bench-v4-'));
  const tempConfigPath = path.join(tempDir, `config.${suiteName}.json`);
  await fs.writeFile(tempConfigPath, JSON.stringify(config, null, 2));

  const passthroughArgs = [];
  const passthroughFlags = ['--headed', '--skip-warmup', '--flamegraphs'];
  const passthroughPairs = [
    '--profile',
    '--iterations',
    '--seed',
    '--throttle',
    '--cpu',
    '--network',
    '--flamegraph-dir',
    '--flamegraph-frameworks',
    '--flamegraph-profiles',
    '--flamegraph-scenarios',
    '--flamegraph-phases',
    '--flamegraph-max-iteration',
    '--flamegraph-sample-interval',
  ];

  for (const flag of passthroughFlags) {
    if (hasFlag(flag)) passthroughArgs.push(flag);
  }
  for (const pair of passthroughPairs) {
    const value = argValue(pair, null);
    if (value != null) passthroughArgs.push(pair, value);
  }

  try {
    if (!hasFlag('--skip-contract-report')) {
      await runContractReport({ tempDir, suiteName, targetsPath, matrixPath, suitesDir, only });
    }
    await runLegacyRunner({ configPath: tempConfigPath, outPath, passthroughArgs });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function isMain() {
  return Boolean(process.argv[1]) && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isMain()) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
