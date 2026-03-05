import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BENCH_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(BENCH_DIR, "..");

export const DEFAULT_MATRIX_PATH = path.join(BENCH_DIR, "framework-matrix.json");
export const DEFAULT_TARGETS_PATH = path.join(BENCH_DIR, "targets.live.json");
export const DEFAULT_SUITES_DIR = path.join(BENCH_DIR, "suites");

export function parseCsvSet(value) {
  const tokens = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return new Set(tokens);
}

export function toAbsolutePath(value, fallback) {
  if (!value) return fallback;
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function loadMatrix(matrixPath = DEFAULT_MATRIX_PATH) {
  const doc = await readJson(matrixPath);
  const frameworks = Array.isArray(doc.frameworks) ? doc.frameworks : [];
  const byName = new Map();

  for (const row of frameworks) {
    const name = String(row?.name || "");
    if (!name) continue;
    if (byName.has(name)) {
      throw new Error(`Duplicate framework in matrix: ${name}`);
    }
    byName.set(name, row);
  }

  return { path: matrixPath, doc, frameworks, byName };
}

export async function loadTargets(targetsPath = DEFAULT_TARGETS_PATH) {
  const doc = await readJson(targetsPath);
  const targets = Array.isArray(doc.targets) ? doc.targets : [];
  return { path: targetsPath, doc, targets };
}

export async function resolveLiveTargets({
  matrixPath = DEFAULT_MATRIX_PATH,
  targetsPath = DEFAULT_TARGETS_PATH,
  only = null,
  requireWorkers = true,
  requireEnabled = true,
} = {}) {
  const [matrix, targetsDoc] = await Promise.all([
    loadMatrix(matrixPath),
    loadTargets(targetsPath),
  ]);

  const allow = only && only.size ? only : null;
  const seen = new Set();
  const out = [];

  for (const row of targetsDoc.targets) {
    const name = String(row?.framework || "");
    const url = String(row?.url || "").replace(/\/$/, "");
    const platform = String(row?.platform || "");

    if (!name || !url) continue;
    if (allow && !allow.has(name)) continue;
    if (seen.has(name)) {
      throw new Error(`Duplicate target for framework: ${name}`);
    }
    seen.add(name);

    const meta = matrix.byName.get(name);
    if (!meta) {
      throw new Error(`Target framework ${name} is not defined in matrix.`);
    }
    if (requireEnabled && !meta.benchmarkEnabled) {
      throw new Error(`Target framework ${name} is disabled in matrix.`);
    }
    if (requireWorkers && platform !== "workers") {
      throw new Error(`Target framework ${name} is not workers platform.`);
    }
    if (/\.pages\.dev\b/i.test(url)) {
      throw new Error(`Target framework ${name} points to pages.dev (${url}).`);
    }

    out.push({
      name,
      framework: name,
      url,
      platform,
      matrix: meta,
    });
  }

  if (!out.length) {
    throw new Error("No live targets resolved from targets + matrix.");
  }

  return out;
}

export async function loadSuite(id, suitesDir = DEFAULT_SUITES_DIR) {
  const suitePath = path.join(suitesDir, `${id}.json`);
  const doc = await readJson(suitePath);
  const scenarios = Array.isArray(doc.scenarios) ? doc.scenarios : [];
  const requiredRoutes = Array.isArray(doc.requiredRoutes) ? doc.requiredRoutes : [];

  if (!scenarios.length) {
    throw new Error(`Suite ${id} has no scenarios.`);
  }

  return { id, path: suitePath, doc, scenarios, requiredRoutes };
}

