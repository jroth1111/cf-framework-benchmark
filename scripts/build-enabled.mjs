#!/usr/bin/env node
import { spawn } from "node:child_process";
import { loadMatrix, parseCsvSet, DEFAULT_MATRIX_PATH, toAbsolutePath } from "../bench/src/config-v4.mjs";

const buildEnv = {
  ...process.env,
  CI: process.env.CI ?? "1",
  NUXT_TELEMETRY_DISABLED: process.env.NUXT_TELEMETRY_DISABLED ?? "1",
};

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

async function run(label, command, args, cwd) {
  console.log(`\n==> ${label}`);
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: buildEnv,
      shell: false,
    });

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with exit code ${code}`));
    });
    child.on("error", reject);
  });
}

const matrixPath = toAbsolutePath(argValue("--matrix", null), DEFAULT_MATRIX_PATH);
const only = parseCsvSet(argValue("--only", ""));
const matrix = await loadMatrix(matrixPath);

const enabled = matrix.frameworks.filter((framework) => {
  if (!framework?.benchmarkEnabled) return false;
  if (only.size && !only.has(framework.name)) return false;
  return Boolean(framework.appDir);
});

if (!enabled.length) {
  throw new Error("No benchmark-enabled app workspaces selected for build.");
}

for (const framework of enabled) {
  await run(`build:${framework.name}`, "pnpm", ["-C", framework.appDir, "run", "build"]);
}

console.log(`\nBuilt ${enabled.length} benchmark-enabled app workspaces.`);
