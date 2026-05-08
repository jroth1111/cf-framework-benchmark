import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BENCH_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadColoRegions() {
  const raw = readFileSync(path.join(BENCH_ROOT, 'colo-regions.json'), 'utf8');
  return JSON.parse(raw).regions;
}

export function loadCanonicalGeography() {
  const raw = readFileSync(path.join(BENCH_ROOT, 'canonical-geography.json'), 'utf8');
  return JSON.parse(raw);
}

/**
 * Classifies the geography coverage of a benchmark run.
 * @param {string[]} edgeLocations - Array of colo prefix strings (e.g. ["MEL", "IAD", "FRA"])
 * @param {Record<string,string[]>} [coloRegions] - Optional override; defaults to colo-regions.json
 * @returns {{ regions: Set<string>, unknown: string[], coverage: string }}
 */
export function classifyGeography(edgeLocations, coloRegions = null) {
  const regions = coloRegions || loadColoRegions();
  const coloToRegion = new Map();
  for (const [region, colos] of Object.entries(regions)) {
    for (const colo of colos) coloToRegion.set(colo, region);
  }

  const seen = new Set();
  const unknown = [];
  for (const colo of (edgeLocations || [])) {
    const region = coloToRegion.get(colo);
    if (region) seen.add(region);
    else unknown.push(colo);
  }

  let coverage;
  const hasAPAC = seen.has('APAC');
  const hasUS = seen.has('US');
  const hasEU = seen.has('EU');
  if (hasAPAC && hasUS && hasEU) coverage = 'global';
  else if (hasAPAC && hasUS) coverage = 'apac+us';
  else if (hasAPAC && hasEU) coverage = 'apac+eu';
  else if (hasUS && hasEU) coverage = 'us+eu';
  else if (hasAPAC) coverage = 'apac-only';
  else if (hasUS) coverage = 'us-only';
  else if (hasEU) coverage = 'eu-only';
  else coverage = 'no-geo';

  return { regions: seen, unknown, coverage };
}

/**
 * Returns the canonical class label for a run's geography.
 * MEL-only runs get a special legacy label for back-compat with existing reports.
 */
export function canonicalClass(edgeLocations, coloRegions = null) {
  const { regions, coverage } = classifyGeography(edgeLocations, coloRegions);

  if (coverage === 'global') return 'canonical';

  // Special-case: single-MEL runs common in CI; preserve legacy label.
  if (
    edgeLocations &&
    edgeLocations.length > 0 &&
    new Set(edgeLocations).size === 1 &&
    edgeLocations[0] === 'MEL'
  ) {
    return 'canonical-MEL-only';
  }

  if (coverage === 'apac-only') return 'canonical-apac-only';
  if (coverage === 'us-only') return 'canonical-us-only';
  if (coverage === 'eu-only') return 'canonical-eu-only';
  if (coverage === 'apac+us') return 'canonical-apac+us';
  if (coverage === 'apac+eu') return 'canonical-apac+eu';
  if (coverage === 'us+eu') return 'canonical-us+eu';
  return 'canonical-no-geo';
}
