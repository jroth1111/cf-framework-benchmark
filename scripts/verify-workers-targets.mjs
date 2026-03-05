#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

async function main() {
  const targetsPath = argValue('--targets', path.join(process.cwd(), 'bench', 'targets.live.json'));
  const matrixPath = argValue('--matrix', path.join(process.cwd(), 'bench', 'framework-matrix.json'));

  const targetsDoc = JSON.parse(await fs.readFile(targetsPath, 'utf8'));
  const matrixDoc = JSON.parse(await fs.readFile(matrixPath, 'utf8'));

  const targets = Array.isArray(targetsDoc.targets) ? targetsDoc.targets : [];
  const matrix = Array.isArray(matrixDoc.frameworks) ? matrixDoc.frameworks : [];
  const matrixByName = new Map(matrix.map((fw) => [fw.name, fw]));

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
