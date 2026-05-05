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

function isGeneratedHtml(relativePath) {
  return /^pages\/.+\.html$/i.test(relativePath);
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

function isPrefetchDisclosureLine(line) {
  if (!/modulepreload|rel=["']preload["']/.test(line)) return false;
  return /_RE\b|RegExp|\.replace|replace\(|CLIENT_.*RE|\\s\*<link|\/\\s\*<|links\.push/.test(line);
}

function prefetchHitsForSource(sourceFile) {
  const hits = [];
  const checks = [
    { mode: "disabled", re: /prefetch=\{false\}|prefetch={false}|prefetchStaticAssets:\s*false|data-sveltekit-preload-data=["']off["']/ },
    { mode: "intent", re: /prefetch=["']intent["']/ },
    { mode: "tap", re: /data-sveltekit-preload-data=["']tap["']/ },
    { mode: "hover", re: /data-sveltekit-preload-data=["']hover["']|preload-data=["']hover["']/ },
    { mode: "viewport-or-render", re: /prefetch=["'](render|viewport)["']|modulepreload|rel=["']preload["']/ },
  ];

  for (const line of sourceFile.source.split(/\r?\n/)) {
    if (isPrefetchDisclosureLine(line)) continue;
    for (const check of checks) {
      if (check.re.test(line)) hits.push({ mode: check.mode, file: sourceFile.relative });
    }
  }
  return hits;
}

function classifyPrefetch(sources) {
  const hits = [];
  for (const sourceFile of sources) {
    if (sourceFile.generated) continue;
    hits.push(...prefetchHitsForSource(sourceFile));
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
    if (sourceFile.generated) return false;
    const rel = sourceFile.relative.toLowerCase();
    return rel.includes(`/${scenario}`) || rel.includes(`${scenario}.`) || sourceFile.source.includes(`/${scenario}`);
  });
  const evidence = [];
  for (const sourceFile of routeFiles) {
    const rel = sourceFile.relative.toLowerCase();
    const markers = [];
    if (/\.lazy\.|lazy\s*\(|dynamic\s*\(|import\s*\(/.test(sourceFile.relative) || /lazy\s*\(|dynamic\s*\(|import\s*\(/.test(sourceFile.source)) markers.push("lazy");
    if (/["']use client["']/.test(sourceFile.source)) markers.push("client-island");
    if (/useVisibleTask\$/.test(sourceFile.source)) markers.push("resumable-task");
    if (/useEffect\s*\(|onMount\s*\(|hydrateRoot|createRoot|client:load|client:idle|client:visible|["']use client["']/.test(sourceFile.source)) {
      markers.push("client-hydration");
    }
    if (/canvas|getContext\(|draw[A-Z]|requestAnimationFrame/.test(sourceFile.source)) markers.push("canvas-work");
    if (/fetch\s*\(|routeLoader\$|loader\s*:|createServerFn|server\$|useAsyncData|load\s*\(/.test(sourceFile.source)) markers.push("data-loader");
    if (markers.length) {
      evidence.push({
        file: sourceFile.relative,
        routeSpecific: rel.includes(`/${scenario}`) || rel.includes(`${scenario}.`),
        markers: [...new Set(markers)].sort(),
      });
    }
  }
  const markerSet = new Set(evidence.flatMap((item) => item.markers));
  const routeMarkerSet = new Set(evidence.filter((item) => item.routeSpecific).flatMap((item) => item.markers));
  let risk = "not-detected";
  if (markerSet.has("lazy")) risk = "route-split";
  else if (routeMarkerSet.has("client-island")) risk = "client-island";
  else if (routeMarkerSet.has("client-hydration")) risk = "hydration-on-route-entry";
  else if (markerSet.has("client-hydration")) risk = "instrumented-layout";
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

function arrayIncludesAll(items, required) {
  const set = new Set(Array.isArray(items) ? items : []);
  return required.every((item) => set.has(item));
}

function targetsFramework(variant, name) {
  if (variant.frameworks === "all-enabled-workers" || variant.frameworks === "all-live-results") return true;
  return Array.isArray(variant.frameworks) && variant.frameworks.includes(name);
}

function summarizeOptimizationVariants(doc) {
  const variants = Array.isArray(doc?.variants) ? doc.variants : [];
  const byClass = variants.reduce((acc, variant) => {
    if (variant?.class) acc[variant.class] = (acc[variant.class] ?? 0) + 1;
    return acc;
  }, {});
  return {
    schemaVersion: doc?.schemaVersion ?? null,
    references: doc?.references ?? [],
    requiredClasses: doc?.requiredClasses ?? [],
    classCounts: byClass,
    rankingPolicy: doc?.rankingPolicy ?? null,
    sourceRequirements: doc?.sourceRequirements ?? [],
    variants: variants.map((variant) => ({
      id: variant.id,
      class: variant.class,
      status: variant.status,
      frameworks: variant.frameworks,
      ranking: variant.ranking ?? null,
      bucket: variant.bucket ?? null,
      provenanceFile: variant.provenanceFile ?? null,
    })),
  };
}

function validateOptimizationVariants(doc) {
  const gaps = [];
  const variants = Array.isArray(doc?.variants) ? doc.variants : [];
  const requiredClasses = Array.isArray(doc?.requiredClasses) ? doc.requiredClasses : [];
  const variantClasses = new Set(variants.map((variant) => variant?.class).filter(Boolean));

  for (const requiredClass of requiredClasses) {
    if (!variantClasses.has(requiredClass)) gaps.push(`missing-optimization-class:${requiredClass}`);
  }

  const sourceClasses = new Set((doc?.sourceRequirements ?? []).map((item) => item?.class).filter(Boolean));
  for (const requiredClass of requiredClasses) {
    if (!sourceClasses.has(requiredClass)) gaps.push(`missing-source-requirement-class:${requiredClass}`);
  }

  for (const variant of variants) {
    if (!variant?.id) gaps.push("optimization-variant-missing-id");
    if (!variant?.class) gaps.push(`optimization-variant-missing-class:${variant?.id ?? "unknown"}`);
    if (!variant?.status) gaps.push(`optimization-variant-missing-status:${variant?.id ?? "unknown"}`);
    if (!variant?.frameworks) gaps.push(`optimization-variant-missing-frameworks:${variant?.id ?? "unknown"}`);
  }

  const assetVariants = variants.filter((variant) => variant?.class === "asset-routing-experiment");
  if (!assetVariants.some((variant) => Array.isArray(variant?.configPatch?.assets?.run_worker_first) && variant.configPatch.assets.run_worker_first.includes("/api/*"))) {
    gaps.push("missing-assets-first-api-worker-control");
  }
  if (
    !assetVariants.some((variant) =>
      arrayIncludesAll(variant?.configPatch?.assets?.run_worker_first, ["/", "/stays", "/stays/*", "/blog", "/blog/*", "/chart", "/media", "/api/*"])
    )
  ) {
    gaps.push("missing-worker-first-contract-route-control");
  }

  const traceVariant = variants.find((variant) => variant?.class === "trace-correlation");
  if (!arrayIncludesAll(traceVariant?.capturedHeaders, ["cf-ray", "server-timing", "cf-cache-status", "link"])) {
    gaps.push("missing-trace-correlation-headers");
  }
  if (!arrayIncludesAll(traceVariant?.derivedFields, ["colo", "serverTiming", "linkHeader", "http103EarlyHints"])) {
    gaps.push("missing-trace-correlation-derived-fields");
  }

  const platformEra = variants.find((variant) => variant?.class === "platform-era-disclosure");
  if (platformEra?.provenanceFile !== "bench/cloudflare-platform-eras.json") {
    gaps.push("missing-platform-era-provenance-file");
  }

  const earlyHints = variants.find((variant) => variant?.class === "early-hints-link-evidence");
  if (!arrayIncludesAll(earlyHints?.capturedHeaders, ["link"])) {
    gaps.push("missing-early-hints-link-header-capture");
  }
  if (!arrayIncludesAll(earlyHints?.capturedCdpEvents, ["Network.responseReceivedExtraInfo statusCode=103"])) {
    gaps.push("missing-early-hints-cdp-event-capture");
  }

  const tanstackPrerender = variants.find((variant) => variant?.class === "tanstack-prerender-mode");
  if (!arrayIncludesAll(tanstackPrerender?.frameworks, ["tanstack-start", "tanstack-start-solid"])) {
    gaps.push("missing-tanstack-prerender-frameworks");
  }
  if (tanstackPrerender?.ranking !== "optimized-only" || tanstackPrerender?.bucket !== "framework-prerender") {
    gaps.push("tanstack-prerender-not-optimized-prerender-bucket");
  }

  const workerdVariant = variants.find((variant) => variant?.class === "workerd-local-harness");
  if (!workerdVariant?.commands?.some((command) => command.includes("wrangler check startup"))) {
    gaps.push("missing-workerd-startup-command");
  }

  const openNextVariants = variants.filter((variant) => variant?.class === "opennext-cache-mode" && targetsFramework(variant, "next"));
  if (!openNextVariants.some((variant) => variant?.openNextConfig?.incrementalCache === "staticAssetsIncrementalCache")) {
    gaps.push("missing-opennext-static-assets-cache-mode");
  }
  if (!openNextVariants.some((variant) => String(variant?.openNextConfig?.incrementalCache ?? "").includes("r2IncrementalCache"))) {
    gaps.push("missing-opennext-r2-cache-mode");
  }

  const vinext = variants.find((variant) => variant?.class === "vinext-diagnostic");
  if (vinext?.ranking !== "excluded") gaps.push("vinext-diagnostic-not-excluded");

  return gaps;
}

function riskSummary(row) {
  const risks = [];
  if (row.boundaryLeaks.length) risks.push("server-client-boundary-leaks");
  if (row.prefetch.classification === "broad-or-implicit") risks.push("broad-prefetch");
  if (row.routes.chart.risk === "hydration-on-route-entry") risks.push("chart-hydration-on-entry");
  if (row.routes.media.risk === "hydration-on-route-entry") risks.push("media-hydration-on-entry");
  return risks;
}

function disclosureSummary(row) {
  const disclosures = [];
  if (row.workerEntrypoint.status === "not-built") disclosures.push("startup-size-needs-build-output");
  if (row.cloudflare.wrangler?.nodejsCompat) disclosures.push("nodejs-compat-startup-surface");
  return disclosures;
}

export async function buildOptimizationAudit({
  cwd = process.cwd(),
  matrixPath = path.join(cwd, "bench", "framework-matrix.json"),
  metadataPath = path.join(cwd, "bench", "cloudflare-frameworks.json"),
  variantsPath = path.join(cwd, "bench", "cloudflare-optimization-variants.json"),
} = {}) {
  const matrix = await readJson(matrixPath);
  const optimizationVariantsDoc = await readJson(variantsPath);
  const configAudit = await buildCloudflareAudit({ cwd, matrixPath, metadataPath });
  const configByName = new Map(configAudit.frameworks.map((row) => [row.name, row]));
  const optimizationVariantGaps = validateOptimizationVariants(optimizationVariantsDoc);
  const variants = Array.isArray(optimizationVariantsDoc?.variants) ? optimizationVariantsDoc.variants : [];
  const rows = [];
  const gaps = [...optimizationVariantGaps];

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
      const relative = normalizePath(path.relative(appDir, filePath));
      sources.push({
        path: filePath,
        relative,
        generated: isGeneratedHtml(relative),
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
      workerdLocalHarness:
        framework.deploy?.type === "workers"
          ? {
              build: `pnpm -C ${normalizePath(path.relative(cwd, appDir))} run build`,
              startup: `npx wrangler check startup ${wrangler?.main ?? "<built-worker>"}`,
            }
          : null,
      assetCaching: {
        headersPath: headers ? normalizePath(path.relative(cwd, headers.path)) : null,
        staticAssetFileCount,
        immutableAssetHeaders: headers ? /Cache-Control:\s*public,\s*max-age=31536000,\s*immutable/i.test(headers.source) : false,
        routeCacheEvidence: routeCacheEvidence(sources),
      },
      optimizationVariants: variants
        .filter((variant) => targetsFramework(variant, framework.name))
        .map((variant) => ({ id: variant.id, class: variant.class, status: variant.status, ranking: variant.ranking ?? null })),
      openNextCacheModes:
        framework.name === "next"
          ? variants
              .filter((variant) => variant.class === "opennext-cache-mode" && targetsFramework(variant, "next"))
              .map((variant) => ({ id: variant.id, status: variant.status, config: variant.openNextConfig ?? null }))
          : [],
      prefetch: classifyPrefetch(sources),
      boundaryLeaks: findBoundaryLeaks(appDir, sources),
      routes: {
        chart: classifyRouteHydration(sources, "chart"),
        media: classifyRouteHydration(sources, "media"),
      },
    };
    row.risks = riskSummary(row);
    row.disclosures = disclosureSummary(row);
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
    optimizationSourceRequirements: optimizationVariantsDoc.sourceRequirements ?? [],
    optimizationVariants: summarizeOptimizationVariants(optimizationVariantsDoc),
    traceCorrelation: variants.find((variant) => variant.class === "trace-correlation") ?? null,
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
    `Optimization classes: ${Object.entries(report.optimizationVariants?.classCounts ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => `${name}=${count}`)
      .join(", ")}`,
    "",
    "| Framework | Tier | Prefetch | Entrypoint | Flags | Risks | Disclosures |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of report.rows.filter((item) => item.benchmarkEnabled)) {
    const flags = row.cloudflare?.wrangler?.compatibilityFlags?.join(", ") || "none";
    const entry = row.workerEntrypoint?.bytes ? `${row.workerEntrypoint.bytes} B` : row.workerEntrypoint?.status ?? "";
    lines.push(
      `| ${row.name} | ${row.tier ?? ""} | ${row.prefetch?.classification ?? ""} | ${entry} | ${flags} | ${(row.risks ?? []).join(", ") || "none"} | ${(row.disclosures ?? []).join(", ") || "none"} |`
    );
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const matrixPath = path.resolve(argValue("--matrix", path.join(process.cwd(), "bench", "framework-matrix.json")));
  const metadataPath = path.resolve(argValue("--metadata", path.join(process.cwd(), "bench", "cloudflare-frameworks.json")));
  const variantsPath = path.resolve(argValue("--variants", path.join(process.cwd(), "bench", "cloudflare-optimization-variants.json")));
  const outPath = argValue("--out", null);
  const markdownPath = argValue("--markdown", null);
  const failOnGaps = hasFlag("--fail-on-gaps");
  const report = await buildOptimizationAudit({ matrixPath, metadataPath, variantsPath });

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
