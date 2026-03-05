import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

function argValue(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function normalizeTargets(doc) {
  const rows = Array.isArray(doc?.targets) ? doc.targets : [];
  return rows
    .filter((row) => row && row.framework && row.url)
    .map((row) => ({
      framework: String(row.framework),
      url: String(row.url).replace(/\/$/, ''),
      platform: row.platform || 'workers',
    }));
}

function mapScenario(sc) {
  const out = {
    name: sc.name,
    path: sc.path,
    type: sc.type === 'spa' ? 'spa' : 'ssr',
    waitFor: sc.waitFor || undefined,
    waitUntil: sc.waitUntil || (sc.type === 'spa' ? 'domcontentloaded' : 'load'),
  };

  if (Array.isArray(sc.interactions) && sc.interactions.length > 0) {
    out.interact = true;
    if (sc.name === 'media') out.interactType = 'media';
    if (sc.name === 'chart') out.interactType = 'chart';
  }

  return out;
}

function toRenderingType(scType) {
  if (scType === 'spa') return 'spa';
  return 'ssr';
}

async function runLegacyRunner({ configPath, outPath, passthroughArgs }) {
  const child = spawn('node', ['./src/run.mjs', '--config', configPath, '--out', outPath, ...passthroughArgs], {
    cwd: path.join(process.cwd(), 'bench'),
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

async function main() {
  const suiteName = argValue('--suite', 'mpa_airbnb');
  const targetsPath = argValue('--targets', path.join(process.cwd(), 'bench', 'targets.live.json'));
  const matrixPath = argValue('--matrix', path.join(process.cwd(), 'bench', 'framework-matrix.json'));
  const outPath = argValue('--out', path.join(process.cwd(), 'bench', `results.v3.${suiteName}.json`));

  const suitePath = path.join(process.cwd(), 'bench', 'suites', `${suiteName}.json`);

  const [suiteDoc, targetsDoc, matrixDoc] = await Promise.all([
    fs.readFile(suitePath, 'utf8').then(JSON.parse),
    fs.readFile(targetsPath, 'utf8').then(JSON.parse),
    fs.readFile(matrixPath, 'utf8').then(JSON.parse),
  ]);

  const targets = normalizeTargets(targetsDoc);
  const scenarios = (Array.isArray(suiteDoc?.scenarios) ? suiteDoc.scenarios : []).map(mapScenario);
  const matrixRows = Array.isArray(matrixDoc?.frameworks) ? matrixDoc.frameworks : [];
  const matrixByName = new Map(matrixRows.map((row) => [row.name, row]));

  if (!scenarios.length) {
    throw new Error(`Suite ${suiteName} has no scenarios.`);
  }

  const frameworks = [];
  for (const target of targets) {
    const meta = matrixByName.get(target.framework);
    if (!meta) {
      throw new Error(`Target framework ${target.framework} is missing from framework matrix.`);
    }
    if (!meta.benchmarkEnabled) {
      continue;
    }
    if (target.platform !== 'workers') {
      throw new Error(`Target ${target.framework} is not workers platform.`);
    }
    if (/\.pages\.dev\b/i.test(target.url)) {
      throw new Error(`Target ${target.framework} points to pages.dev (${target.url}).`);
    }

    const rendering = {};
    for (const sc of scenarios) {
      rendering[sc.name] = toRenderingType(sc.type);
    }

    frameworks.push({
      name: target.framework,
      url: target.url,
      delivery: 'workers',
      features: { clientNav: false },
      rendering,
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

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-bench-v3-'));
  const tempConfigPath = path.join(tempDir, `config.${suiteName}.json`);
  await fs.writeFile(tempConfigPath, JSON.stringify(config, null, 2));

  const passthroughArgs = [];
  const passthroughFlags = ['--headed', '--skip-warmup'];
  const passthroughPairs = ['--profile', '--iterations', '--throttle', '--cpu', '--network'];

  for (const flag of passthroughFlags) {
    if (hasFlag(flag)) passthroughArgs.push(flag);
  }
  for (const pair of passthroughPairs) {
    const value = argValue(pair, null);
    if (value != null) passthroughArgs.push(pair, value);
  }

  try {
    await runLegacyRunner({ configPath: tempConfigPath, outPath, passthroughArgs });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
