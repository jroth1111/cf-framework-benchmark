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
  const match = section.match(/Allowed Values:\s*([\s\S]*?)(?:\n\s*--[a-z-]+=<value>|\n\s*--[a-z-]+,|\n\n[A-Z]|\n$)/i);
  const collected = match?.[1] ?? '';

  const values = (collected.match(/[a-z][a-z0-9-]*/g) || []).filter(
    (token) => !['allowed', 'values'].includes(token)
  );

  if (!values.length) {
    throw new Error('Failed to parse framework values from create-cloudflare help output.');
  }

  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

const DEPRECATED_FRAMEWORKS = new Set(['analog', 'docusaurus', 'gatsby']);

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
  const matrixEntries = rawMatrix.frameworks || [];
  const matrixFrameworks = matrixEntries.map((fw) => fw.name);
  const sortedMatrixFrameworks = [...new Set(matrixFrameworks)].sort((a, b) => a.localeCompare(b));

  if (sortedMatrixFrameworks.length !== matrixFrameworks.length) {
    throw new Error('framework-matrix.json contains duplicate framework names.');
  }

  const helpText = execSync('pnpm create cloudflare@latest --help --json', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const availableC3Frameworks = parseFrameworksFromHelp(helpText);
  const supportedC3Frameworks = availableC3Frameworks.filter((name) => !DEPRECATED_FRAMEWORKS.has(name));
  const validC3Frameworks = new Set(availableC3Frameworks);
  const matrixC3Frameworks = matrixEntries.map((fw) => fw.c3Template || fw.name);
  const coveredC3Frameworks = [...new Set(matrixC3Frameworks)].sort((a, b) => a.localeCompare(b));
  const invalidMappings = matrixEntries
    .filter((fw) => !validC3Frameworks.has(fw.c3Template || fw.name))
    .map((fw) => `${fw.name}:${fw.c3Template || fw.name}`);
  const { missing } = diffSets(supportedC3Frameworks, coveredC3Frameworks);

  if (!missing.length && !invalidMappings.length) {
    console.log(`Framework matrix is in sync (${supportedC3Frameworks.length} required C3 Workers templates).`);
    return;
  }

  if (missing.length) {
    console.error(`Missing from matrix: ${missing.join(', ')}`);
  }
  if (invalidMappings.length) {
    console.error(`Invalid c3Template mappings: ${invalidMappings.join(', ')}`);
  }

  process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
