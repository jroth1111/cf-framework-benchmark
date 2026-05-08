import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateOrThrow } from "./validate-schema.mjs";
import matrixSchemaDef from "../framework-matrix.schema.json" with { type: "json" };

const BENCH_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(BENCH_DIR, "..");
const V5_PATH = path.join(REPO_ROOT, "contracts", "v5.json");

let _cachedV5Doc = null;
async function loadV5Doc() {
  if (_cachedV5Doc) return _cachedV5Doc;
  _cachedV5Doc = JSON.parse(await fs.readFile(V5_PATH, "utf8"));
  return _cachedV5Doc;
}

let _cachedDataset = null;
async function loadDatasetContext() {
  if (_cachedDataset) return _cachedDataset;
  const { blogPosts, listings } = await import("../../packages/dataset/src/index.js");
  _cachedDataset = { blogPosts, listings };
  return _cachedDataset;
}

function resolveStaticSampleExpr(staticSample, route, dataset) {
  if (typeof staticSample === "string") return staticSample;
  if (staticSample && typeof staticSample === "object" && typeof staticSample.from === "string") {
    const match = /^dataset\.(\w+)\[(\d+)\]\.(\w+)$/.exec(staticSample.from);
    if (!match) throw new Error(`Unsupported staticSample.from expression: ${staticSample.from}`);
    const [, collection, idxStr, field] = match;
    const val = dataset[collection]?.[Number(idxStr)]?.[field];
    if (val == null) {
      throw new Error(`Cannot resolve ${staticSample.from}: result is null/undefined`);
    }
    return route.replace(/:([^/]+)/, String(val));
  }
  throw new Error(`Invalid staticSample for route ${route}: ${JSON.stringify(staticSample)}`);
}

function resolveTestIdRef(selector) {
  if (typeof selector === "string") return selector;
  if (selector && typeof selector === "object" && typeof selector.requiredTestId === "string") {
    return `[data-testid="${selector.requiredTestId}"]`;
  }
  return selector;
}

function resolveScenario(sc, v5RouteMap, dataset) {
  if (!sc.routeId) {
    return { ...sc, waitFor: resolveTestIdRef(sc.waitFor) };
  }
  const v5Route = v5RouteMap.get(sc.routeId);
  if (!v5Route) {
    throw new Error(`Suite scenario routeId "${sc.routeId}" not found in v5 routes`);
  }
  const resolvedPath = resolveStaticSampleExpr(v5Route.staticSample, sc.routeId, dataset);
  const resolvedWaitFor = resolveTestIdRef(sc.waitFor);
  const { routeId: _routeId, ...rest } = sc;
  return { ...rest, path: resolvedPath, waitFor: resolvedWaitFor };
}

export const DEFAULT_MATRIX_PATH = path.join(BENCH_DIR, "framework-matrix.json");
export const DEFAULT_MATRIX_SCHEMA_PATH = path.join(BENCH_DIR, "framework-matrix.schema.json");
export const DEFAULT_TARGETS_PATH = path.join(BENCH_DIR, "targets.live.json");
export const DEFAULT_SUITES_DIR = path.join(BENCH_DIR, "suites");

let cachedMatrixSchema = null;
async function loadMatrixSchema(schemaPath = DEFAULT_MATRIX_SCHEMA_PATH) {
  if (cachedMatrixSchema && cachedMatrixSchema.path === schemaPath) {
    return cachedMatrixSchema.doc;
  }
  const doc = JSON.parse(await fs.readFile(schemaPath, "utf8"));
  cachedMatrixSchema = { path: schemaPath, doc };
  return doc;
}

const _schemaDefs = matrixSchemaDef.$defs ?? {};
const IMPLEMENTATION_KINDS = new Set(_schemaDefs.implementationKind?.enum ?? []);
const RENDER_MODES = new Set(_schemaDefs.renderMode?.enum ?? []);
const INITIAL_DATA_MODES = new Set(_schemaDefs.initialDataMode?.enum ?? []);
const HYDRATION_MODELS = new Set(_schemaDefs.hydrationModel?.enum ?? []);

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

function mergeScenarioContracts(base = {}, override = {}) {
  const out = {};
  for (const suiteName of new Set([...Object.keys(base), ...Object.keys(override)])) {
    const baseSuite = base[suiteName];
    const overrideSuite = override[suiteName];
    if (!baseSuite && !overrideSuite) continue;
    const scenarioNames = new Set([
      ...Object.keys(baseSuite || {}),
      ...Object.keys(overrideSuite || {}),
    ]);
    out[suiteName] = {};
    for (const scenarioName of scenarioNames) {
      out[suiteName][scenarioName] = {
        ...(baseSuite?.[scenarioName] || {}),
        ...(overrideSuite?.[scenarioName] || {}),
      };
    }
  }
  return out;
}

function expectEnum(value, allowed, label) {
  if (!allowed.has(value)) {
    throw new Error(`${label} must be one of: ${[...allowed].join(", ")}`);
  }
  return value;
}

function normalizeScenarioContracts(rawContracts, label) {
  const out = {};
  for (const [suiteName, suiteContracts] of Object.entries(rawContracts || {})) {
    if (!suiteContracts || typeof suiteContracts !== "object" || Array.isArray(suiteContracts)) {
      throw new Error(`${label}.scenarioContracts.${suiteName} must be an object.`);
    }
    out[suiteName] = {};
    for (const [scenarioName, contract] of Object.entries(suiteContracts)) {
      if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
        throw new Error(`${label}.scenarioContracts.${suiteName}.${scenarioName} must be an object.`);
      }
      const renderMode = expectEnum(
        String(contract.renderMode || ""),
        RENDER_MODES,
        `${label}.scenarioContracts.${suiteName}.${scenarioName}.renderMode`
      );
      const initialData = expectEnum(
        String(contract.initialData || ""),
        INITIAL_DATA_MODES,
        `${label}.scenarioContracts.${suiteName}.${scenarioName}.initialData`
      );
      const hydrationModel = expectEnum(
        String(contract.hydrationModel || ""),
        HYDRATION_MODELS,
        `${label}.scenarioContracts.${suiteName}.${scenarioName}.hydrationModel`
      );
      out[suiteName][scenarioName] = { renderMode, initialData, hydrationModel };
    }
  }
  return out;
}

export async function loadMatrix(matrixPath = DEFAULT_MATRIX_PATH) {
  const doc = await readJson(matrixPath);
  const schema = await loadMatrixSchema();
  validateOrThrow(schema, doc, `framework matrix at ${matrixPath}`);
  const rawFrameworks = Array.isArray(doc.frameworks) ? doc.frameworks : [];
  const benchmarkDefaults = doc.benchmarkDefaults || {};
  const defaultImplementationKind = expectEnum(
    String(benchmarkDefaults.implementationKind || "native"),
    IMPLEMENTATION_KINDS,
    "benchmarkDefaults.implementationKind"
  );
  const defaultScenarioContracts = normalizeScenarioContracts(
    benchmarkDefaults.scenarioContracts || {},
    "benchmarkDefaults"
  );
  const frameworks = rawFrameworks.map((row) => {
    const name = String(row?.name || "");
    const implementationKind = expectEnum(
      String(row?.implementationKind || defaultImplementationKind),
      IMPLEMENTATION_KINDS,
      `frameworks.${name || "<unknown>"}.implementationKind`
    );
    const scenarioContracts = normalizeScenarioContracts(
      mergeScenarioContracts(defaultScenarioContracts, row?.scenarioContracts || {}),
      `frameworks.${name || "<unknown>"}`
    );
    return {
      ...row,
      implementationKind,
      scenarioContracts,
    };
  });
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
      matrixDefaults: matrix.doc?.benchmarkDefaults ?? null,
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
  const rawScenarios = Array.isArray(doc.scenarios) ? doc.scenarios : [];

  if (!rawScenarios.length) {
    throw new Error(`Suite ${id} has no scenarios.`);
  }

  const [v5Doc, dataset] = await Promise.all([loadV5Doc(), loadDatasetContext()]);
  const v5RouteMap = new Map(v5Doc.routes.map((r) => [r.route, r]));

  const scenarios = rawScenarios.map((sc) => resolveScenario(sc, v5RouteMap, dataset));

  // Derive requiredRoutes from v5 suite membership
  const requiredRoutes = v5Doc.routes.filter((r) => r.suites.includes(id)).map((r) => r.route);

  return { id, path: suitePath, doc, scenarios, requiredRoutes };
}
