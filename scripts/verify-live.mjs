#!/usr/bin/env node
import { spawn } from "node:child_process";

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function pushPair(args, flag) {
  const value = argValue(flag, null);
  if (value != null) args.push(flag, value);
}

function pushFlag(args, flag) {
  if (hasFlag(flag)) args.push(flag);
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
const contractArgs = [];
const smokeArgs = [];

pushPair(matrixArgs, "--matrix");
pushPair(targetsArgs, "--matrix");
pushPair(targetsArgs, "--targets");

for (const args of [contractArgs, smokeArgs]) {
  pushPair(args, "--matrix");
  pushPair(args, "--targets");
  pushPair(args, "--suites-dir");
  pushPair(args, "--suites");
  pushPair(args, "--only");
  pushPair(args, "--timeout");
}

pushFlag(smokeArgs, "--headed");
pushPair(smokeArgs, "--slowmo");

await run("check:matrix", "pnpm", ["check:matrix", ...matrixArgs]);
await run("check:targets", "pnpm", ["check:targets", ...targetsArgs]);
await run("test:contracts", "pnpm", ["test:contracts", ...contractArgs]);
await run("smoke", "pnpm", ["smoke", ...smokeArgs]);

console.log("\nLive verification passed.");
