#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { buildCloudflareAudit } from "./cloudflare-config-audit.mjs";
import { DEFAULT_MATRIX_PATH, parseCsvSet, toAbsolutePath } from "../bench/src/config-v4.mjs";

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function pushPair(args, flag) {
  const value = argValue(flag, null);
  if (value != null) args.push(flag, value);
}

async function run(label, command, args, cwd) {
  console.log(`\n==> ${label}`);
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: process.env,
      shell: false,
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with exit code ${code}`));
    });
    child.on("error", reject);
  });
}

async function cleanupWranglerStartupArtifacts(appDir) {
  await fs.rm(path.join(appDir, "worker-startup.cpuprofile"), { force: true });
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function startupArgsForApp(appDir) {
  const generatedConfigCandidates = [
    "dist/server/wrangler.json",
    ".output/server/wrangler.json",
    "build/server/wrangler.json",
    "dist/worker/wrangler.json",
  ];
  for (const rel of generatedConfigCandidates) {
    const configPath = path.join(appDir, rel);
    if (await fileExists(configPath)) {
      return ["--config", configPath];
    }
  }

  await fs.rm(path.join(appDir, ".wrangler", "deploy"), { recursive: true, force: true });
  return [];
}

async function moveStartupProfile({ appDir, artifactDir, frameworkName }) {
  const profilePath = path.join(appDir, "worker-startup.cpuprofile");
  try {
    await fs.mkdir(artifactDir, { recursive: true });
    await fs.rename(profilePath, path.join(artifactDir, `${frameworkName}.cpuprofile`));
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }
}

const matrixPath = toAbsolutePath(argValue("--matrix", null), DEFAULT_MATRIX_PATH);
const only = parseCsvSet(argValue("--only", ""));
const audit = await buildCloudflareAudit({ matrixPath });
const repoRoot = process.cwd();
const artifactDir = path.join(
  repoRoot,
  "bench",
  "flamegraphs",
  "startup",
  new Date().toISOString().replace(/[:.]/g, "-")
);
const selected = audit.frameworks.filter((row) => {
  if (!row.benchmarkEnabled || row.deployType !== "workers") return false;
  if (!row.wrangler?.main) return false;
  return !only.size || only.has(row.name);
});

if (!selected.length) {
  throw new Error("No benchmark-enabled Worker rows with Wrangler entrypoints were selected.");
}

const passthroughArgs = [];
pushPair(passthroughArgs, "--args");

for (const row of selected) {
  const appDir = path.resolve(repoRoot, row.appDir);
  await cleanupWranglerStartupArtifacts(appDir);
  const startupArgs = await startupArgsForApp(appDir);
  try {
    await run(
      `wrangler check startup: ${row.name}`,
      "pnpm",
      ["exec", "wrangler", "check", "startup", ...startupArgs, ...passthroughArgs],
      appDir
    );
    await moveStartupProfile({ appDir, artifactDir, frameworkName: row.name });
  } finally {
    await cleanupWranglerStartupArtifacts(appDir);
  }
}

console.log(`\nWorker startup checks passed. CPU profiles: ${path.relative(repoRoot, artifactDir)}`);
