#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseJsonc, printParseErrorCode } from "jsonc-parser";
import { parse as parseToml } from "smol-toml";

const CONTRACTS_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "contracts",
  "v5.json"
);
const CONTRACTS = JSON.parse(await fs.readFile(CONTRACTS_PATH, "utf8"));

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function parseJsoncStrict(source, label) {
  const errors = [];
  const value = parseJsonc(source, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length) {
    const detail = errors
      .map((err) => `${printParseErrorCode(err.error)} at offset ${err.offset} (length ${err.length})`)
      .join("; ");
    throw new Error(`Invalid JSONC in ${label}: ${detail}`);
  }
  return value;
}

export async function readWranglerConfig(appDir) {
  const candidates = ["wrangler.jsonc", "wrangler.toml"];
  for (const name of candidates) {
    const filePath = path.join(appDir, name);
    let raw;
    try {
      raw = await fs.readFile(filePath, "utf8");
    } catch (err) {
      if (err?.code === "ENOENT") continue;
      throw err;
    }
    try {
      const parsed = name.endsWith(".jsonc") ? parseJsoncStrict(raw, filePath) : parseToml(raw);
      return { path: filePath, format: name.endsWith(".jsonc") ? "jsonc" : "toml", parsed };
    } catch (err) {
      throw new Error(`Failed to parse ${filePath}: ${err.message}`);
    }
  }
  return null;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map(String);
  if (value == null) return [];
  return [String(value)];
}

function normalizeRunWorkerFirst(value) {
  if (value === true) return ["*"];
  if (value === false || value == null) return [];
  return normalizeArray(value);
}

function routeMatchesPattern(route, pattern) {
  if (pattern === route) return true;
  if (pattern.endsWith("*")) return route.startsWith(pattern.slice(0, -1));
  return false;
}

const CONTRACT_ROUTES = CONTRACTS.routes
  .filter((route) => route.includeInAssetClassification)
  .map((route) => route.staticSample);

function classifyAssetRouting(assets) {
  if (!assets) {
    return {
      mode: "worker-only",
      contractRoutesThroughWorker: CONTRACT_ROUTES,
      contractRoutesAssetFirst: [],
      routePatterns: [],
    };
  }
  if (assets.run_worker_first === true) {
    return {
      mode: "worker-first-for-contract-routes",
      contractRoutesThroughWorker: CONTRACT_ROUTES,
      contractRoutesAssetFirst: [],
      routePatterns: ["*"],
    };
  }
  const routePatterns = normalizeRunWorkerFirst(assets.run_worker_first);
  if (!routePatterns.length) {
    return {
      mode: "asset-first-with-worker-fallback",
      contractRoutesThroughWorker: [],
      contractRoutesAssetFirst: CONTRACT_ROUTES,
      routePatterns,
    };
  }
  const throughWorker = CONTRACT_ROUTES.filter((route) => routePatterns.some((pattern) => routeMatchesPattern(route, pattern)));
  const assetFirst = CONTRACT_ROUTES.filter((route) => !throughWorker.includes(route));
  return {
    mode: assetFirst.length ? "mixed-worker-first" : "worker-first-for-contract-routes",
    contractRoutesThroughWorker: throughWorker,
    contractRoutesAssetFirst: assetFirst,
    routePatterns,
  };
}

function summarizeConfig(config) {
  if (!config) return null;
  const parsed = config.parsed;
  const assets = parsed.assets ?? null;
  const observability = parsed.observability ?? null;
  const compatibilityFlags = normalizeArray(parsed.compatibility_flags);
  return {
    configPath: config.path,
    configFormat: config.format,
    name: parsed.name ?? null,
    main: parsed.main ?? null,
    compatibilityDate: parsed.compatibility_date ?? null,
    compatibilityFlags,
    nodejsCompat: compatibilityFlags.includes("nodejs_compat"),
    assets: assets
      ? {
          binding: assets.binding ?? null,
          directory: assets.directory ?? null,
          htmlHandling: assets.html_handling ?? null,
          notFoundHandling: assets.not_found_handling ?? null,
          runWorkerFirst: normalizeRunWorkerFirst(assets.run_worker_first),
        }
      : null,
    assetRouting: classifyAssetRouting(assets),
    observability: {
      enabled: observability?.enabled === true,
      configured: observability != null,
    },
  };
}

function buildFrameworkRow({ framework, metadata, config, hifiOnly }) {
  const gaps = [];
  if (!metadata) gaps.push("missing-cloudflare-metadata");
  if (framework?.deploy?.type === "workers" && !config) gaps.push("missing-wrangler-config");
  if (config && !config.main) gaps.push("missing-main");
  if (config && !config.compatibilityDate) gaps.push("missing-compatibility-date");
  if (config?.assets && !config.assets.directory) gaps.push("missing-assets-directory");
  if (framework?.benchmarkEnabled && metadata && !metadata.officialGuide) gaps.push("missing-official-guide");
  if (framework?.benchmarkEnabled && metadata && !metadata.benchmarkMode) gaps.push("missing-benchmark-mode");

  const hifi = framework?.hifi ?? null;
  if (hifiOnly && hifi?.enabled === true && hifi?.imageTransforms !== "enabled") {
    gaps.push("hifi-image-transforms-missing");
  }

  return {
    name: framework.name,
    tier: framework.tier ?? null,
    status: framework.status ?? null,
    benchmarkEnabled: framework.benchmarkEnabled === true,
    appDir: framework.appDir ?? null,
    deployType: framework.deploy?.type ?? null,
    cloudflare: metadata ?? null,
    wrangler: config,
    hifi,
    gaps,
    ok: gaps.length === 0,
  };
}

function markdownTable(rows) {
  const header = [
    "| Framework | Tier | Mode | Support | Maturity | Routing | Flags | Observability | Wrangler | Gaps |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  const body = rows.map((row) => {
    const wrangler = row.wrangler;
    const flags = wrangler?.compatibilityFlags?.length ? wrangler.compatibilityFlags.join(", ") : "none";
    const observability = wrangler?.observability?.configured ? String(wrangler.observability.enabled) : "not configured";
    return [
      row.name,
      row.tier ?? "",
      row.cloudflare?.benchmarkMode ?? "",
      row.cloudflare?.cloudflareSupport ?? "",
      row.cloudflare?.maturity ?? "",
      wrangler?.assetRouting?.mode ?? "missing",
      flags,
      observability,
      wrangler?.configPath ?? "missing",
      row.gaps.length ? row.gaps.join(", ") : "none",
    ];
  });
  return [...header, ...body.map((cells) => `| ${cells.map((cell) => String(cell).replaceAll("|", "\\|")).join(" | ")} |`)].join("\n");
}

export async function buildCloudflareAudit({
  cwd = process.cwd(),
  matrixPath = path.join(cwd, "bench", "framework-matrix.json"),
  hifiOnly = false,
} = {}) {
  const matrixDoc = JSON.parse(await fs.readFile(matrixPath, "utf8"));
  const frameworks = [];

  for (const framework of matrixDoc.frameworks ?? []) {
    const appDir = framework.appDir ? path.resolve(cwd, framework.appDir) : null;
    const wranglerConfig = appDir ? summarizeConfig(await readWranglerConfig(appDir)) : null;
    frameworks.push(
      buildFrameworkRow({
        framework,
        metadata: framework.cloudflare ?? null,
        config: wranglerConfig,
        hifiOnly,
      })
    );
  }

  const targetRows = hifiOnly
    ? frameworks.filter((row) => row.deployType === "workers" && row.hifi?.enabled === true)
    : frameworks.filter((row) => row.benchmarkEnabled && row.deployType === "workers");
  const report = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    matrixPath,
    mode: hifiOnly ? "hifi" : "default",
    ok: targetRows.every((row) => row.ok),
    gapCount: targetRows.reduce((count, row) => count + row.gaps.length, 0),
    frameworkCount: frameworks.length,
    enabledWorkersCount: targetRows.length,
    frameworks,
  };
  return report;
}

async function main() {
  const matrixPath = path.resolve(argValue("--matrix", path.join(process.cwd(), "bench", "framework-matrix.json")));
  const outPath = argValue("--out", null);
  const markdownPath = argValue("--markdown", null);
  const failOnGaps = hasFlag("--fail-on-gaps");
  const hifiOnly = hasFlag("--hifi");
  const report = await buildCloudflareAudit({ matrixPath, hifiOnly });

  if (outPath) {
    await fs.mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
    await fs.writeFile(path.resolve(outPath), `${JSON.stringify(report, null, 2)}\n`);
  }
  if (markdownPath) {
    await fs.mkdir(path.dirname(path.resolve(markdownPath)), { recursive: true });
    const targetRows = hifiOnly
      ? report.frameworks.filter((row) => row.deployType === "workers" && row.hifi?.enabled === true)
      : report.frameworks.filter((row) => row.benchmarkEnabled && row.deployType === "workers");
    const heading = hifiOnly ? "# Cloudflare Config Audit (hifi suite)" : "# Cloudflare Config Audit";
    await fs.writeFile(
      path.resolve(markdownPath),
      `${heading}\n\nGenerated: ${report.generatedAt}\n\n${markdownTable(targetRows)}\n`
    );
  }

  const label = hifiOnly ? "hifi-mode " : "";
  console.log(`Cloudflare ${label}config audit ${report.ok ? "passed" : "failed"} (${report.enabledWorkersCount} ${hifiOnly ? "hifi" : "enabled"} Workers targets, ${report.gapCount} gaps).`);
  if (failOnGaps && !report.ok) {
    const gappy = hifiOnly
      ? report.frameworks.filter((item) => item.deployType === "workers" && item.hifi?.enabled === true && item.gaps.length)
      : report.frameworks.filter((item) => item.benchmarkEnabled && item.gaps.length);
    for (const row of gappy) {
      console.error(`- ${row.name}: ${row.gaps.join(", ")}`);
    }
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
