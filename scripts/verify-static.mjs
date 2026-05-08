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
await run("test:bench-contract", "pnpm", ["test:bench-contract"]);
await run("test:bench-runner", "pnpm", ["test:bench-runner"]);
await run("test:contract-report", "pnpm", ["test:contract-report"]);
await run("test:control-package", "pnpm", ["test:control-package"]);
await run("test:hifi-live-header-config", "pnpm", ["test:hifi-live-header-config"]);
await run("test:verify-results", "pnpm", ["test:verify-results"]);
await run("test:ci-workflows", "pnpm", ["test:ci-workflows"]);
await run("verify:result-artifacts", "pnpm", ["verify:results", "--", "--all-local", "--artifact-policy"]);
await run("test:bench-stability", "pnpm", ["test:bench-stability"]);
await run("test:cloudflare-config", "pnpm", ["test:cloudflare-config"]);
await run("test:cloudflare-config-fixtures", "pnpm", ["test:cloudflare-config-fixtures"]);
await run("test:version-packages", "pnpm", ["test:version-packages"]);
await run("test:no-direct-targets-read", "pnpm", ["test:no-direct-targets-read"]);
await run("test:app-delegation", "pnpm", ["test:app-delegation"]);
await run("test:cloudflare-optimization", "pnpm", ["test:cloudflare-optimization"]);
await run("test:cloudflare-optimization-variants-schema", "pnpm", ["test:cloudflare-optimization-variants-schema"]);
await run("test:selectors-derived", "pnpm", ["test:selectors-derived"]);
await run("test:dataset-derived-paths", "pnpm", ["test:dataset-derived-paths"]);
await run("test:required-testid-coverage", "pnpm", ["test:required-testid-coverage"]);
await run("test:smoke-contract-selectors", "pnpm", ["test:smoke-contract-selectors"]);
await run("test:contract-api-cache", "pnpm", ["test:contract-api-cache"]);
await run("test:contracts-schema", "pnpm", ["test:contracts-schema"]);
await run("test:results-schema", "pnpm", ["test:results-schema"]);
await run("test:runner-imports-timings", "pnpm", ["test:runner-imports-timings"]);
await run("test:profile-catalog-external", "pnpm", ["test:profile-catalog-external"]);
await run("test:canonical-geography", "pnpm", ["test:canonical-geography"]);
await run("test:platform-era-stamp", "pnpm", ["test:platform-era-stamp"]);
await run("test:marker-contract", "pnpm", ["test:marker-contract"]);
await run("test:contract-version-derived", "pnpm", ["test:contract-version-derived"]);
await run("test:lighthouse-rubric-parity", "pnpm", ["test:lighthouse-rubric-parity"]);
await run("test:config-v4-enum-parity", "pnpm", ["test:config-v4-enum-parity"]);
await run("test:response-defaults-runtime", "pnpm", ["test:response-defaults-runtime"]);
await run("test:no-inline-route-registration", "pnpm", ["test:no-inline-route-registration"]);
await run("cloudflare:config-audit", "pnpm", ["cloudflare:config-audit", "--fail-on-gaps"]);
await run("cloudflare:optimization-audit", "pnpm", ["cloudflare:optimization-audit", "--fail-on-gaps"]);
await run("test:build-enabled", "pnpm", ["test:build-enabled"]);
await run("build:enabled", "pnpm", ["build:enabled", ...matrixArgs]);
await run("check:startup", "pnpm", ["check:startup", ...matrixArgs]);

console.log("\nStatic verification passed.");
