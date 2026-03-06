#!/usr/bin/env node
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import {
  DEFAULT_MATRIX_PATH,
  DEFAULT_TARGETS_PATH,
  loadMatrix,
  parseCsvSet,
  toAbsolutePath,
} from "../bench/src/config-v4.mjs";

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

async function updateTargets(targetsPath, frameworks, deployedMap) {
  const doc = {
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    source: "bench/framework-matrix.json",
    targets: frameworks.map((framework) => ({
      framework: framework.name,
      platform: "workers",
      url: deployedMap.get(framework.name),
    })),
  };

  await fs.writeFile(targetsPath, `${JSON.stringify(doc, null, 2)}\n`);
}

async function main() {
  const only = parseCsvSet(argValue("--only", ""));
  const matrixPath = toAbsolutePath(argValue("--matrix", null), DEFAULT_MATRIX_PATH);
  const targetsPath = toAbsolutePath(argValue("--targets", null), DEFAULT_TARGETS_PATH);
  const noWrite = process.argv.includes("--no-write");

  const matrix = await loadMatrix(matrixPath);
  const frameworks = matrix.frameworks.filter((framework) => {
    if (!framework?.benchmarkEnabled) return false;
    if (String(framework?.deploy?.type || "") !== "workers") return false;
    if (only.size && !only.has(framework.name)) return false;
    return true;
  });

  if (!frameworks.length) {
    throw new Error("No benchmark-enabled Workers frameworks selected for deployment.");
  }

  const deployed = new Map();
  for (const framework of frameworks) {
    const meta = matrix.byName.get(framework.name);
    const command = String(meta?.deploy?.command || "").trim();
    if (!command) {
      throw new Error(`Missing deploy.command for framework ${framework.name} in matrix.`);
    }

    console.log(`\n==> Deploying ${framework.name}`);
    const result = await runAndCollect(command);
    const url = extractDeployUrl(result.combined);
    if (!url) {
      throw new Error(`Failed to detect deploy URL for ${framework.name}.`);
    }
    if (/\.pages\.dev\b/i.test(url)) {
      throw new Error(`Deploy for ${framework.name} returned pages.dev URL (${url}).`);
    }

    deployed.set(framework.name, url.replace(/\/$/, ""));
    console.log(`✓ ${framework.name} -> ${url}`);
  }

  if (!noWrite) {
    await updateTargets(targetsPath, frameworks, deployed);
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
