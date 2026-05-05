#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildCloudflareAudit } from "./cloudflare-config-audit.mjs";

const TEXT_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".vue", ".svelte", ".astro", ".html", ".json", ".jsonc", ".toml"]);
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".next", ".nuxt", ".output", ".astro", ".wrangler", "coverage"]);
const UI_DIR_PARTS = new Set(["app", "src", "pages", "routes", "components", "views"]);

const SERVER_ONLY_PATTERNS = [
  { id: "cloudflare-workers-import", re: /from\s+["']cloudflare:workers["']|import\s*\(\s*["']cloudflare:workers["']\s*\)/ },
  { id: "node-built-in-import", re: /from\s+["']node:(fs|child_process|cluster|worker_threads|net|tls|dns)["']|from\s+["'](fs|child_process|cluster|worker_threads|net|tls|dns)["']/ },
  { id: "process-env", re: /\bprocess\.env\b/ },
  { id: "worker-binding-type", re: /\b(D1Database|KVNamespace|DurableObjectNamespace|R2Bucket|ExecutionContext)\b/ },
  { id: "database-client", re: /\b(PrismaClient|drizzle-orm|node-postgres|postgres(?:ql)?|bcrypt)\b/ },
];

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join("/");
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(root) {
  const files = [];
  async function visit(dir) {
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err?.code === "ENOENT") return;
      throw err;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".assetsignore") continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await visit(fullPath);
        continue;
      }
      if (TEXT_EXTENSIONS.has(path.extname(entry.name))) files.push(fullPath);
    }
  }
  await visit(root);
  return files.sort((a, b) => a.localeCompare(b));
}

async function readExisting(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

function isClientCandidate(appDir, filePath) {
  const rel = normalizePath(path.relative(appDir, filePath));
  if (!rel || rel.startsWith("..")) return false;
  if (/worker-configuration\.d\.ts$/.test(rel)) return false;
  if (/(^|\/)(worker|server|api|entry-server|middleware|scripts)(\/|\.|$)/.test(rel)) return false;
  if (/(^|\/)(vite|wrangler|next|nuxt|app)\.config\./.test(rel)) return false;
  const parts = rel.split("/");
  return parts.some((part) => UI_DIR_PARTS.has(part));
}

function lineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function findBoundaryLeaks(appDir, sources) {
  const leaks = [];
  for (const sourceFile of sources) {
    if (!isClientCandidate(appDir, sourceFile.path)) continue;
    for (const pattern of SERVER_ONLY_PATTERNS) {
      const match = pattern.re.exec(sourceFile.source);
      if (match) {
        leaks.push({
          file: normalizePath(path.relative(appDir, sourceFile.path)),
          line: lineNumber(sourceFile.source, match.index),
          pattern: pattern.id,
          sample: match[0].slice(0, 120),
        });
      }
    }
  }
  return leaks;
}

function classifyPrefetch(sources) {
  const hits = [];
  for (const sourceFile of sources) {
    const rel = sourceFile.relative;
    const source = sourceFile.source;
    const checks = [
      { mode: "disabled", re: /prefetch=\{false\}|prefetch={false}|prefetchStaticAssets:\s*false|data-sveltekit-preload-data=["']off["']/ },
      { mode: "intent", re: /prefetch=["']intent["']/ },
      { mode: "tap", re: /data-sveltekit-preload-data=["']tap["']/ },
      { mode: "hover", re: /data-sveltekit-preload-data=["']hover["']|preload-data=["']hover["']/ },
      { mode: "viewport-or-render", re: /prefetch=["'](render|viewport)["']|modulepreload|rel=["']preload["']/ },
    ];
    for (const check of checks) {
      if (check.re.test(source)) hits.push({ mode: check.mode, file: rel });
    }
  }
  const modes = [...new Set(hits.map((hit) => hit.mode))].sort();
  let classification = "not-detected";
  if (modes.includes("disabled")) classification = "disabled-or-opt-in";
  else if (modes.includes("tap") || modes.includes("intent")) classification = "selective";
  else if (modes.includes("hover") || modes.includes("viewport-or-render")) classification = "broad-or-implicit";
  return { classification, modes, evidence: hits.slice(0, 20) };
}

function classifyRouteHydration(sources, scenario) {
  const routeFiles = sources.filter((sourceFile) => {
    const rel = sourceFile.relative.toLowerCase();
    return rel.includes(`/${scenario}`) || rel.includes(`${scenario}.`) || sourceFile.source.includes(`/${scenario}`);
  });
  const evidence = [];
  for (const sourceFile of routeFiles) {
    const markers = [];
    if (/\.lazy\.|lazy\s*\(|dynamic\s*\(|import\s*\(/.test(sourceFile.relative) || /lazy\s*\(|dynamic\s*\(|import\s*\(/.test(sourceFile.source)) markers.push("lazy");
    if (/useVisibleTask\$|useEffect\s*\(|onMount\s*\(|hydrateRoot|createRoot|client:load|client:idle|client:visible|["']use client["']/.test(sourceFile.source)) {
      markers.push("client-hydration");
    }
    if (/canvas|getContext\(|draw[A-Z]|requestAnimationFrame/.test(sourceFile.source)) markers.push("canvas-work");
    if (/fetch\s*\(|routeLoader\$|loader\s*:|createServerFn|server\$|useAsyncData|load\s*\(/.test(sourceFile.source)) markers.push("data-loader");
    if (markers.length) {
      evidence.push({ file: sourceFile.relative, markers: [...new Set(markers)].sort() });
    }
  }
  const markerSet = new Set(evidence.flatMap((item) => item.markers));
  const risk = markerSet.has("client-hydration") && !markerSet.has("lazy") ? "hydration-on-route-entry" : markerSet.has("lazy") ? "route-split" : "not-detected";
  return { risk, files: routeFiles.length, evidence: evidence.slice(0, 12) };
}

async function readPackage(appDir) {
  const packagePath = path.join(appDir, "package.json");
  const raw = await readExisting(packagePath);
  return raw ? JSON.parse(raw) : null;
}

async function readHeaders(appDir) {
  const candidates = [path.join(appDir, "public", "_headers"), path.join(appDir, "_headers")];
  for (const filePath of candidates) {
    const source = await readExisting(filePath);
    if (source != null) return { path: filePath, source };
  }
  return null;
}

async function countStaticAssetFiles(appDir, wrangler) {
  const directory = wrangler?.assets?.directory;
  if (!directory) return 0;
  const assetDir = path.resolve(appDir, directory);
  let count = 0;
  async function visit(dir) {
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      if (err?.code === "ENOENT") return;
      throw err;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) await visit(fullPath);
      else count += 1;
    }
  }
  await visit(assetDir);
  return count;
}

async function workerEntrypointSize(cwd, appDir, wrangler) {
  const main = wrangler?.main;
  if (!main) return { status: "missing-main" };
  const mainPath = path.resolve(appDir, main);
  try {
    const stat = await fs.stat(mainPath);
    return { status: "present", path: normalizePath(path.relative(cwd, mainPath)), bytes: stat.size };
  } catch (err) {
    if (err?.code === "ENOENT") return { status: "not-built", path: normalizePath(path.relative(cwd, mainPath)) };
    throw err;
  }
}

function routeCacheEvidence(sources) {
  return sources
    .filter((sourceFile) => /cache-control/i.test(sourceFile.source))
    .map((sourceFile) => ({ file: sourceFile.relative, matches: (sourceFile.source.match(/cache-control/gi) || []).length }))
    .slice(0, 20);
}

function sourceRequirementLinks() {
  return [
    "cloudflare/workers-sdk#7344",
    "cloudflare/workerd#2372",
    "cloudflare/workers-sdk#7650",
    "remix-run/react-router#14934",
    "TanStack/router#5738",
    "TanStack/router#6400",
    "sveltejs/kit#12578",
    "nuxt/nuxt#30786",
    "wakujs/waku#1912",
    "withastro/astro#15606",
    "QwikDev/qwik#8198",
  ];
}

function riskSummary(row) {
  const risks = [];
  if (row.boundaryLeaks.length) risks.push("server-client-boundary-leaks");
  if (row.prefetch.classification === "broad-or-implicit") risks.push("broad-prefetch");
  if (row.workerEntrypoint.status === "not-built") risks.push("startup-size-needs-build-output");
  if (row.cloudflare.wrangler?.nodejsCompat) risks.push("nodejs-compat-startup-surface");
  if (row.routes.chart.risk === "hydration-on-route-entry") risks.push("chart-hydration-on-entry");
  if (row.routes.media.risk === "hydration-on-route-entry") risks.push("media-hydration-on-entry");
  return risks;
}

export async function buildOptimizationAudit({
  cwd = process.cwd(),
  matrixPath = path.join(cwd, "bench", "framework-matrix.json"),
  metadataPath = path.join(cwd, "bench", "cloudflare-frameworks.json"),
} = {}) {
  const matrix = await readJson(matrixPath);
  const configAudit = await buildCloudflareAudit({ cwd, matrixPath, metadataPath });
  const configByName = new Map(configAudit.frameworks.map((row) => [row.name, row]));
  const rows = [];
  const gaps = [];

  for (const framework of matrix.frameworks ?? []) {
    const appDir = framework.appDir ? path.resolve(cwd, framework.appDir) : null;
    if (!appDir || !(await exists(appDir))) {
      const gap = `missing-app-dir:${framework.name}`;
      if (framework.benchmarkEnabled) gaps.push(gap);
      rows.push({ name: framework.name, gaps: [gap] });
      continue;
    }

    const files = await walkFiles(appDir);
    const sources = [];
    for (const filePath of files) {
      const source = await fs.readFile(filePath, "utf8");
      sources.push({
        path: filePath,
        relative: normalizePath(path.relative(appDir, filePath)),
        source,
      });
    }

    const cloudflare = configByName.get(framework.name) ?? null;
    const wrangler = cloudflare?.wrangler ?? null;
    const packageJson = await readPackage(appDir);
    const headers = await readHeaders(appDir);
    const staticAssetFileCount = await countStaticAssetFiles(appDir, wrangler);
    const row = {
      name: framework.name,
      tier: framework.tier ?? null,
      status: framework.status ?? null,
      benchmarkEnabled: framework.benchmarkEnabled === true,
      appDir: normalizePath(path.relative(cwd, appDir)),
      packageScripts: {
        build: packageJson?.scripts?.build ?? null,
        deploy: packageJson?.scripts?.deploy ?? framework.deploy?.command ?? null,
      },
      cloudflare: {
        benchmarkMode: cloudflare?.cloudflare?.benchmarkMode ?? null,
        maturity: cloudflare?.cloudflare?.maturity ?? null,
        wrangler,
      },
      workerEntrypoint: await workerEntrypointSize(cwd, appDir, wrangler),
      startupProbe: framework.deploy?.type === "workers" ? `pnpm -C ${normalizePath(path.relative(cwd, appDir))} run build && npx wrangler check startup ${wrangler?.main ?? "<built-worker>"}` : null,
      assetCaching: {
        headersPath: headers ? normalizePath(path.relative(cwd, headers.path)) : null,
        staticAssetFileCount,
        immutableAssetHeaders: headers ? /Cache-Control:\s*public,\s*max-age=31536000,\s*immutable/i.test(headers.source) : false,
        routeCacheEvidence: routeCacheEvidence(sources),
      },
      prefetch: classifyPrefetch(sources),
      boundaryLeaks: findBoundaryLeaks(appDir, sources),
      routes: {
        chart: classifyRouteHydration(sources, "chart"),
        media: classifyRouteHydration(sources, "media"),
      },
    };
    row.risks = riskSummary(row);
    rows.push(row);
  }

  const enabledRows = rows.filter((row) => row.benchmarkEnabled);
  for (const row of enabledRows) {
    if (!row.cloudflare?.wrangler) gaps.push(`missing-wrangler-audit:${row.name}`);
    if (!row.assetCaching?.headersPath && row.assetCaching?.staticAssetFileCount > 0) gaps.push(`missing-asset-headers:${row.name}`);
  }

  return {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    sourceRequirements: sourceRequirementLinks(),
    ok: gaps.length === 0,
    gaps,
    frameworkCount: rows.length,
    enabledFrameworkCount: enabledRows.length,
    riskCounts: rows.reduce((acc, row) => {
      for (const risk of row.risks ?? []) acc[risk] = (acc[risk] ?? 0) + 1;
      return acc;
    }, {}),
    rows,
  };
}

function markdown(report) {
  const lines = [
    "# Cloudflare Optimization Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Required gaps: ${report.gaps.length}`,
    "",
    "| Framework | Tier | Prefetch | Entrypoint | Flags | Risks |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of report.rows.filter((item) => item.benchmarkEnabled)) {
    const flags = row.cloudflare?.wrangler?.compatibilityFlags?.join(", ") || "none";
    const entry = row.workerEntrypoint?.bytes ? `${row.workerEntrypoint.bytes} B` : row.workerEntrypoint?.status ?? "";
    lines.push(`| ${row.name} | ${row.tier ?? ""} | ${row.prefetch?.classification ?? ""} | ${entry} | ${flags} | ${(row.risks ?? []).join(", ") || "none"} |`);
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const matrixPath = path.resolve(argValue("--matrix", path.join(process.cwd(), "bench", "framework-matrix.json")));
  const metadataPath = path.resolve(argValue("--metadata", path.join(process.cwd(), "bench", "cloudflare-frameworks.json")));
  const outPath = argValue("--out", null);
  const markdownPath = argValue("--markdown", null);
  const failOnGaps = hasFlag("--fail-on-gaps");
  const report = await buildOptimizationAudit({ matrixPath, metadataPath });

  if (outPath) {
    await fs.mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
    await fs.writeFile(path.resolve(outPath), `${JSON.stringify(report, null, 2)}\n`);
  }
  if (markdownPath) {
    await fs.mkdir(path.dirname(path.resolve(markdownPath)), { recursive: true });
    await fs.writeFile(path.resolve(markdownPath), markdown(report));
  }

  console.log(
    `Cloudflare optimization audit ${report.ok ? "passed" : "has required gaps"} (${report.enabledFrameworkCount} enabled frameworks, ${Object.keys(report.riskCounts).length} risk classes).`
  );
  if (Object.keys(report.riskCounts).length) {
    for (const [risk, count] of Object.entries(report.riskCounts).sort()) {
      console.log(`- ${risk}: ${count}`);
    }
  }
  if (failOnGaps && !report.ok) {
    for (const gap of report.gaps) console.error(`- ${gap}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
