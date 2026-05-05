#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function stripJsonComments(source) {
  let out = "";
  let inString = false;
  let quote = "";
  let escaped = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (inString) {
      out += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        inString = false;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      out += char;
      continue;
    }
    if (char === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      out += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i += 1;
      continue;
    }
    out += char;
  }
  return out;
}

function parseTomlValue(raw) {
  const value = raw.trim();
  if (value.startsWith("[") && value.endsWith("]")) {
    const body = value.slice(1, -1).trim();
    if (!body) return [];
    return body
      .split(",")
      .map((item) => parseTomlValue(item))
      .filter((item) => item !== "");
  }
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function parseToml(source) {
  const root = {};
  let section = root;
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = root;
      for (const part of sectionMatch[1].split(".")) {
        section[part] ??= {};
        section = section[part];
      }
      continue;
    }
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    section[key] = parseTomlValue(line.slice(eqIdx + 1));
  }
  return root;
}

async function readWranglerConfig(appDir) {
  const candidates = ["wrangler.jsonc", "wrangler.toml"];
  for (const name of candidates) {
    const filePath = path.join(appDir, name);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = name.endsWith(".jsonc") ? JSON.parse(stripJsonComments(raw)) : parseToml(raw);
      return { path: filePath, format: name.endsWith(".jsonc") ? "jsonc" : "toml", parsed };
    } catch (err) {
      if (err?.code !== "ENOENT") throw new Error(`Failed to parse ${filePath}: ${err.message}`);
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

const CONTRACT_ROUTES = ["/", "/stays", "/stays/001", "/blog", "/blog/why-this-benchmark-exists", "/chart", "/media", "/api/bench"];

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

function buildFrameworkRow({ framework, metadata, config }) {
  const gaps = [];
  if (!metadata) gaps.push("missing-cloudflare-metadata");
  if (framework?.deploy?.type === "workers" && !config) gaps.push("missing-wrangler-config");
  if (config && !config.main) gaps.push("missing-main");
  if (config && !config.compatibilityDate) gaps.push("missing-compatibility-date");
  if (config?.assets && !config.assets.directory) gaps.push("missing-assets-directory");
  if (framework?.benchmarkEnabled && metadata && !metadata.officialGuide) gaps.push("missing-official-guide");
  if (framework?.benchmarkEnabled && metadata && !metadata.benchmarkMode) gaps.push("missing-benchmark-mode");

  return {
    name: framework.name,
    tier: framework.tier ?? null,
    status: framework.status ?? null,
    benchmarkEnabled: framework.benchmarkEnabled === true,
    appDir: framework.appDir ?? null,
    deployType: framework.deploy?.type ?? null,
    cloudflare: metadata ?? null,
    wrangler: config,
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
  metadataPath = path.join(cwd, "bench", "cloudflare-frameworks.json"),
} = {}) {
  const matrixDoc = JSON.parse(await fs.readFile(matrixPath, "utf8"));
  const metadataDoc = JSON.parse(await fs.readFile(metadataPath, "utf8"));
  const metadataByName = metadataDoc.frameworks ?? {};
  const frameworks = [];

  for (const framework of matrixDoc.frameworks ?? []) {
    const appDir = framework.appDir ? path.resolve(cwd, framework.appDir) : null;
    const wranglerConfig = appDir ? summarizeConfig(await readWranglerConfig(appDir)) : null;
    frameworks.push(
      buildFrameworkRow({
        framework,
        metadata: metadataByName[framework.name] ?? null,
        config: wranglerConfig,
      })
    );
  }

  const enabled = frameworks.filter((row) => row.benchmarkEnabled && row.deployType === "workers");
  const report = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    matrixPath,
    metadataPath,
    ok: enabled.every((row) => row.ok),
    gapCount: enabled.reduce((count, row) => count + row.gaps.length, 0),
    frameworkCount: frameworks.length,
    enabledWorkersCount: enabled.length,
    frameworks,
  };
  return report;
}

async function main() {
  const matrixPath = path.resolve(argValue("--matrix", path.join(process.cwd(), "bench", "framework-matrix.json")));
  const metadataPath = path.resolve(argValue("--metadata", path.join(process.cwd(), "bench", "cloudflare-frameworks.json")));
  const outPath = argValue("--out", null);
  const markdownPath = argValue("--markdown", null);
  const failOnGaps = hasFlag("--fail-on-gaps");
  const report = await buildCloudflareAudit({ matrixPath, metadataPath });

  if (outPath) {
    await fs.mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
    await fs.writeFile(path.resolve(outPath), `${JSON.stringify(report, null, 2)}\n`);
  }
  if (markdownPath) {
    await fs.mkdir(path.dirname(path.resolve(markdownPath)), { recursive: true });
    const enabled = report.frameworks.filter((row) => row.benchmarkEnabled && row.deployType === "workers");
    await fs.writeFile(
      path.resolve(markdownPath),
      `# Cloudflare Config Audit\n\nGenerated: ${report.generatedAt}\n\n${markdownTable(enabled)}\n`
    );
  }

  console.log(`Cloudflare config audit ${report.ok ? "passed" : "failed"} (${report.enabledWorkersCount} enabled Workers targets, ${report.gapCount} gaps).`);
  if (failOnGaps && !report.ok) {
    for (const row of report.frameworks.filter((item) => item.benchmarkEnabled && item.gaps.length)) {
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
