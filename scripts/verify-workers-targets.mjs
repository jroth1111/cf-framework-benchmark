#!/usr/bin/env node
import {
  DEFAULT_MATRIX_PATH,
  DEFAULT_TARGETS_PATH,
  loadMatrix,
  loadTargets,
  toAbsolutePath,
} from '../bench/src/config-v4.mjs';

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

async function main() {
  const targetsPath = toAbsolutePath(argValue('--targets', null), DEFAULT_TARGETS_PATH);
  const matrixPath = toAbsolutePath(argValue('--matrix', null), DEFAULT_MATRIX_PATH);

  const matrix = await loadMatrix(matrixPath);
  const targetsDoc = await loadTargets(targetsPath);

  const targets = targetsDoc.targets;
  const matrixFrameworks = matrix.frameworks;
  const matrixByName = matrix.byName;
  const expectedWorkers = matrixFrameworks
    .filter((fw) => fw?.benchmarkEnabled && String(fw?.deploy?.type || '') === 'workers')
    .map((fw) => fw.name);
  const actualWorkers = targets.map((target) => target.framework).filter(Boolean);

  const failures = [];
  const seen = new Set();

  for (const target of targets) {
    const framework = target.framework;
    const url = target.url || '';
    const platform = target.platform;

    if (!framework) {
      failures.push('Target is missing framework field.');
      continue;
    }

    if (seen.has(framework)) {
      failures.push(`Duplicate target for framework: ${framework}`);
      continue;
    }
    seen.add(framework);

    if (!matrixByName.has(framework)) {
      failures.push(`Target framework ${framework} is not defined in framework matrix.`);
      continue;
    }

    if (platform !== 'workers') {
      failures.push(`Framework ${framework} has invalid platform ${String(platform)} (expected workers).`);
    }

    if (!/^https:\/\//.test(url)) {
      failures.push(`Framework ${framework} has non-https URL: ${url}`);
      continue;
    }

    if (/\.pages\.dev\b/i.test(url)) {
      failures.push(`Framework ${framework} uses a pages.dev URL, which is not allowed: ${url}`);
    }

    const fwMeta = matrixByName.get(framework);
    if (!fwMeta?.benchmarkEnabled) {
      failures.push(`Framework ${framework} is targeted live but benchmarkEnabled is false in matrix.`);
    }
  }

  const expectedSet = new Set(expectedWorkers);
  const actualSet = new Set(actualWorkers);
  const missing = expectedWorkers.filter((framework) => !actualSet.has(framework));
  const extra = actualWorkers.filter((framework) => !expectedSet.has(framework));

  if (missing.length) {
    failures.push(`Missing workers targets for enabled frameworks: ${missing.join(', ')}`);
  }
  if (extra.length) {
    failures.push(`Targets exist for non-enabled or non-workers frameworks: ${extra.join(', ')}`);
  }

  if (failures.length) {
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`Workers target validation passed (${targets.length} targets).`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
