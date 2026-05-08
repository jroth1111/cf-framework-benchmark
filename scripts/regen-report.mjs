#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildMarkdown } from '../bench/src/report.mjs';

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function listSuiteJsonPaths() {
  const entries = await fs.readdir('bench');
  return entries
    .filter((entry) => /^results\.v4\.[^.]+\.json$/.test(entry) && !entry.includes('.dirty.') && !entry.endsWith('.schema.json'))
    .map((entry) => path.join('bench', entry))
    .sort((a, b) => a.localeCompare(b));
}

function suiteIdFromPath(jsonPath) {
  return path.basename(jsonPath).match(/^results\.v4\.([^.]+)/)?.[1] ?? null;
}

async function regenOne(jsonPath, { suffix = '' } = {}) {
  const raw = await fs.readFile(jsonPath, 'utf8');
  const out = JSON.parse(raw);
  const md = buildMarkdown(out, { suiteId: suiteIdFromPath(jsonPath) });
  const mdPath = jsonPath.replace(/\.json$/, `.md${suffix}`);
  await fs.writeFile(mdPath, md);
  return mdPath;
}

function usage() {
  console.error('Usage:');
  console.error('  node scripts/regen-report.mjs --suite <suite-id> [--regen-suffix]');
  console.error('  node scripts/regen-report.mjs --json bench/results.v4.<suite>.json [--out <md-path>]');
  console.error('  node scripts/regen-report.mjs --all [--regen-suffix]');
  console.error('');
  console.error('Default behavior overwrites the .md pair in place. With --regen-suffix the');
  console.error('output is written to <jsonPath without .json>.md.regen for byte-exact diffing.');
  process.exit(2);
}

async function main() {
  const suite = argValue('--suite', null);
  const json = argValue('--json', null);
  const outArg = argValue('--out', null);
  const all = hasFlag('--all');
  const suffix = hasFlag('--regen-suffix') ? '.regen' : '';

  if (!suite && !json && !all) usage();

  const targets = [];
  if (json) {
    targets.push(json);
  } else if (suite) {
    targets.push(path.join('bench', `results.v4.${suite}.json`));
  } else if (all) {
    targets.push(...(await listSuiteJsonPaths()));
  }

  let failures = 0;
  for (const target of targets) {
    try {
      const mdPath = outArg && targets.length === 1
        ? await (async () => {
            const raw = await fs.readFile(target, 'utf8');
            const out = JSON.parse(raw);
            const md = buildMarkdown(out, { suiteId: suiteIdFromPath(target) });
            await fs.writeFile(outArg, md);
            return outArg;
          })()
        : await regenOne(target, { suffix });
      console.log(`📝 ${target} -> ${mdPath}`);
    } catch (err) {
      failures += 1;
      console.error(`❌ ${target}: ${err?.message || err}`);
    }
  }

  if (failures) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
