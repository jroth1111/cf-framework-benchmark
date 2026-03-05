#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

function parseFrameworksFromHelp(helpText) {
  const marker = '--framework=<value>';
  const idx = helpText.indexOf(marker);
  if (idx === -1) {
    throw new Error('Could not find --framework section in create-cloudflare help output.');
  }

  const section = helpText.slice(idx);
  const lines = section.split('\n');
  let inAllowed = false;
  let collected = '';

  for (const rawLine of lines) {
    const line = rawLine || '';
    if (!inAllowed) {
      if (line.includes('Allowed Values:')) {
        inAllowed = true;
      }
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      if (collected.trim().length > 0) break;
      continue;
    }

    if (trimmed.startsWith('--')) {
      break;
    }

    collected += ` ${trimmed}`;
  }

  const values = (collected.match(/[a-z][a-z0-9-]*/g) || []).filter(
    (token) => !['allowed', 'values'].includes(token)
  );

  if (!values.length) {
    throw new Error('Failed to parse framework values from create-cloudflare help output.');
  }

  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function diffSets(expected, actual) {
  const exp = new Set(expected);
  const act = new Set(actual);
  const missing = expected.filter((name) => !act.has(name));
  const extra = actual.filter((name) => !exp.has(name));
  return { missing, extra };
}

async function main() {
  const matrixPath = process.argv[2] || path.join(process.cwd(), 'bench', 'framework-matrix.json');

  const rawMatrix = JSON.parse(await fs.readFile(matrixPath, 'utf8'));
  const matrixFrameworks = (rawMatrix.frameworks || []).map((fw) => fw.name);
  const sortedMatrixFrameworks = [...new Set(matrixFrameworks)].sort((a, b) => a.localeCompare(b));

  if (sortedMatrixFrameworks.length !== matrixFrameworks.length) {
    throw new Error('framework-matrix.json contains duplicate framework names.');
  }

  const helpText = execSync('pnpm create cloudflare@latest --help', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const c3Frameworks = parseFrameworksFromHelp(helpText);
  const { missing, extra } = diffSets(c3Frameworks, sortedMatrixFrameworks);

  if (!missing.length && !extra.length) {
    console.log(`Framework matrix is in sync (${c3Frameworks.length} frameworks).`);
    return;
  }

  if (missing.length) {
    console.error(`Missing from matrix: ${missing.join(', ')}`);
  }
  if (extra.length) {
    console.error(`Extra in matrix: ${extra.join(', ')}`);
  }

  process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
