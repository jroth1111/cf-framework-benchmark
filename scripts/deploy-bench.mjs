#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PREFIX = process.env.CF_BENCH_PREFIX || "cf-benchmark";

const FRAMEWORKS = [
  { name: "react-vite", pkg: "cf-bench-react-vite", dir: "apps/react-vite" },
  { name: "react-spa", pkg: "cf-bench-react-spa", dir: "apps/react-spa" },
  { name: "astro", pkg: "cf-bench-astro", dir: "apps/astro" },
  {
    name: "nextjs",
    pkg: "cf-bench-nextjs",
    dir: "apps/nextjs",
    buildCmd: "pnpm -C apps/nextjs exec opennextjs-cloudflare build",
    useTempConfig: true,
  },
  {
    name: "tanstack-start",
    pkg: "cf-bench-tanstack-start",
    dir: "apps/tanstack-start",
  },
  { name: "sveltekit", pkg: "cf-bench-sveltekit", dir: "apps/sveltekit" },
  { name: "qwik", pkg: "cf-bench-qwik", dir: "apps/qwik" },
  { name: "solid", pkg: "cf-bench-solid", dir: "apps/solid" },
];

function parseArgs(argv) {
  const args = argv.slice(2);
  let prefix = DEFAULT_PREFIX;
  let only = null;
  let configPath = path.join(ROOT, "bench", "bench.config.json");

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--prefix") {
      prefix = args[i + 1] || prefix;
      i += 1;
      continue;
    }
    if (arg === "--only") {
      const next = args[i + 1] || "";
      only = new Set(next.split(",").map((item) => item.trim()).filter(Boolean));
      i += 1;
      continue;
    }
    if (arg === "--config") {
      const next = args[i + 1];
      if (next) {
        configPath = path.resolve(ROOT, next);
      }
      i += 1;
      continue;
    }
  }

  return { prefix, only, configPath };
}

function runAndCollect(cmd, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, {
      cwd,
      shell: true,
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        const err = new Error(`Command failed (${code}): ${cmd}`);
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
        return;
      }
      resolve({ stdout, stderr, combined: `${stdout}\n${stderr}` });
    });
  });
}

function extractDeployUrl(output) {
  const urls = output.match(/https?:\/\/[^\s)]+/g) || [];
  const candidates = urls.filter(
    (url) => url.includes(".workers.dev") || url.includes(".pages.dev"),
  );
  return candidates[candidates.length - 1] || urls[urls.length - 1] || null;
}

async function deployFramework(entry, prefix) {
  const workerName = `${prefix}-${entry.name}`;
  console.log(`\n==> Deploying ${entry.name} (${workerName})`);
  const buildCmd =
    entry.buildCmd || `pnpm --filter ${entry.pkg} run build`;
  await runAndCollect(buildCmd, ROOT);

  let deployCmd = `pnpm -C ${entry.dir} exec wrangler deploy --name ${workerName}`;
  let configPath = null;
  let originalConfig = null;
  if (entry.useTempConfig) {
    configPath = path.join(ROOT, entry.dir, "wrangler.toml");
    originalConfig = fs.readFileSync(configPath, "utf8");
    const updated = originalConfig.match(/^name\s*=/m)
      ? originalConfig.replace(/^name\s*=\s*".*?"/m, `name = "${workerName}"`)
      : `name = "${workerName}"\n${originalConfig}`;
    fs.writeFileSync(configPath, updated);
    deployCmd = `pnpm -C ${entry.dir} exec wrangler deploy`;
  }

  let result;
  try {
    result = await runAndCollect(deployCmd, ROOT);
  } finally {
    if (configPath && originalConfig !== null) {
      try {
        fs.writeFileSync(configPath, originalConfig);
      } catch {
        // ignore
      }
    }
  }

  const url = extractDeployUrl(result.combined);
  if (!url) {
    throw new Error(`Failed to detect deployed URL for ${entry.name}.`);
  }
  return url;
}

function updateBenchConfig(configPath, deployed) {
  const raw = fs.readFileSync(configPath, "utf8");
  const config = JSON.parse(raw);
  const frameworkMap = new Map(config.frameworks.map((fw) => [fw.name, fw]));

  for (const [name, url] of Object.entries(deployed)) {
    const target = frameworkMap.get(name);
    if (target) {
      target.url = url;
    }
  }

  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

async function main() {
  const { prefix, only, configPath } = parseArgs(process.argv);
  const selected = only
    ? FRAMEWORKS.filter((fw) => only.has(fw.name))
    : FRAMEWORKS;

  if (selected.length === 0) {
    console.error("No frameworks selected for deploy.");
    process.exit(1);
  }

  const deployed = {};
  for (const entry of selected) {
    const url = await deployFramework(entry, prefix);
    deployed[entry.name] = url;
    console.log(`✓ ${entry.name} -> ${url}`);
  }

  updateBenchConfig(configPath, deployed);

  console.log("\nUpdated bench config:");
  for (const [name, url] of Object.entries(deployed)) {
    console.log(`- ${name}: ${url}`);
  }
  console.log(`\nConfig: ${path.relative(ROOT, configPath)}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
