#!/usr/bin/env node
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import {
  DEFAULT_MATRIX_PATH,
  DEFAULT_TARGETS_PATH,
  loadMatrix,
  parseCsvSet,
  resolveLiveTargets,
  toAbsolutePath,
} from "../bench/src/config-v3.mjs";

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function runAndCollect(cmd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, {
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
    child.on("error", reject);
  });
}

function extractDeployUrl(output) {
  const urls = output.match(/https?:\/\/[^\s)]+/g) || [];
  const workers = urls.filter((url) => /\.workers\.dev\b/i.test(url));
  if (workers.length) return workers[workers.length - 1];
  return urls[urls.length - 1] || null;
}

async function updateTargets(targetsPath, deployedMap) {
  const doc = JSON.parse(await fs.readFile(targetsPath, "utf8"));
  const rows = Array.isArray(doc.targets) ? doc.targets : [];

  for (const row of rows) {
    const nextUrl = deployedMap.get(row.framework);
    if (nextUrl) row.url = nextUrl;
  }

  await fs.writeFile(targetsPath, `${JSON.stringify(doc, null, 2)}\n`);
}

async function main() {
  const only = parseCsvSet(argValue("--only", ""));
  const matrixPath = toAbsolutePath(argValue("--matrix", null), DEFAULT_MATRIX_PATH);
  const targetsPath = toAbsolutePath(argValue("--targets", null), DEFAULT_TARGETS_PATH);
  const noWrite = process.argv.includes("--no-write");

  const [liveTargets, matrix] = await Promise.all([
    resolveLiveTargets({
      matrixPath,
      targetsPath,
      only,
      requireWorkers: true,
      requireEnabled: true,
    }),
    loadMatrix(matrixPath),
  ]);

  const deployed = new Map();
  for (const target of liveTargets) {
    const meta = matrix.byName.get(target.name);
    const command = String(meta?.deploy?.command || "").trim();
    if (!command) {
      throw new Error(`Missing deploy.command for framework ${target.name} in matrix.`);
    }

    console.log(`\n==> Deploying ${target.name}`);
    const result = await runAndCollect(command);
    const url = extractDeployUrl(result.combined);
    if (!url) {
      throw new Error(`Failed to detect deploy URL for ${target.name}.`);
    }
    if (/\.pages\.dev\b/i.test(url)) {
      throw new Error(`Deploy for ${target.name} returned pages.dev URL (${url}).`);
    }

    deployed.set(target.name, url.replace(/\/$/, ""));
    console.log(`✓ ${target.name} -> ${url}`);
  }

  if (!noWrite) {
    await updateTargets(targetsPath, deployed);
    console.log(`\nUpdated ${targetsPath}`);
  }

  console.log("\nDeploy summary:");
  for (const [name, url] of deployed.entries()) {
    console.log(`- ${name}: ${url}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
