#!/usr/bin/env node
import { spawn } from "node:child_process";

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function pushPair(args, flag) {
  const value = argValue(flag, null);
  if (value != null) args.push(flag, value);
}

async function run(label, command, args) {
  console.log(`\n==> ${label}`);
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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

const matrixArgs = [];
const targetsArgs = [];

pushPair(matrixArgs, "--matrix");
pushPair(targetsArgs, "--matrix");
pushPair(targetsArgs, "--targets");

await run("check:matrix", "pnpm", ["check:matrix", ...matrixArgs]);
await run("check:targets", "pnpm", ["check:targets", ...targetsArgs]);
await run("test:dataset", "pnpm", ["test:dataset"]);
await run("test:deploy-bench", "pnpm", ["test:deploy-bench"]);
await run("test:bench-runner", "pnpm", ["test:bench-runner"]);
await run("test:control-package", "pnpm", ["test:control-package"]);
await run("test:verify-results", "pnpm", ["test:verify-results"]);
await run("test:bench-stability", "pnpm", ["test:bench-stability"]);
await run("test:cloudflare-config", "pnpm", ["test:cloudflare-config"]);
await run("cloudflare:config-audit", "pnpm", ["cloudflare:config-audit", "--fail-on-gaps"]);
await run("test:build-enabled", "pnpm", ["test:build-enabled"]);
await run("build:enabled", "pnpm", ["build:enabled", ...matrixArgs]);

console.log("\nStatic verification passed.");
