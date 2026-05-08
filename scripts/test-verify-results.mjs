#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { provenanceHashForRow } from "../bench/src/provenance.mjs";
import { verifyResultArtifactPolicy, verifyResultPair } from "./verify-results.mjs";

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-bench-verify-results-"));
const baseShape = {
  iterations: 1,
  frameworks: [],
  profiles: ["parity"],
  phases: ["cold"],
  scenarios: [],
};
try {
  const git = { commit: "abc123", branch: "test", describe: "abc123", dirty: false };
  const seed = "seed-1";
  const row = {
    framework: "demo",
    profile: "parity",
    phase: "cold",
    scenario: "home",
    iteration: 1,
    ok: true,
    status: 200,
    headers: { "cf-ray": "test-MEL" },
    serverMetrics: { ttfb: 12 },
    synthetic: { nav: { ttfb: 12 }, cwv: { lcp: { value: 100 } }, longTasks: { tbt: 0 } },
  };
  row.provenanceHash = provenanceHashForRow(row, git, seed);

  const jsonPath = path.join(tempDir, "results.v4.demo.json");
  const mdPath = path.join(tempDir, "results.v4.demo.md");
  await fs.writeFile(
    jsonPath,
    JSON.stringify(
      {
        ts: "2026-05-05T00:00:00.000Z",
        ...baseShape,
        runOrder: { seed },
        provenance: {
          git,
          hashes: { matrix: "m", targets: "t", lockfile: "l", contract: "c", contractsJson: "cj", scoring: "sr", suites: "su", cloudflarePlatform: "cfp", cloudflareConfig: "cf", cloudflareOptimization: "cfo" },
          cloudflarePlatform: { activeEra: "pingora-cache-2026-05-04" },
          cloudflareAudit: { ok: true },
          cloudflareOptimizationAudit: { ok: true },
        },
        scoring: { model: "real-world-choice-v1" },
        failures: [],
        rows: [row],
      },
      null,
      2
    )
  );
  await fs.writeFile(
    mdPath,
    [
      "Generated: 2026-05-05T00:00:00.000Z",
      "Failures: 0",
      "seed-1",
      "abc123",
      "real-world-choice-v1",
    ].join("\n")
  );

  assert.equal((await verifyResultPair(jsonPath)).ok, true);

  row.status = 500;
  await fs.writeFile(
    jsonPath,
    JSON.stringify(
      {
        ts: "2026-05-05T00:00:00.000Z",
        ...baseShape,
        runOrder: { seed },
        provenance: {
          git,
          hashes: { matrix: "m", targets: "t", lockfile: "l", contract: "c", contractsJson: "cj", scoring: "sr", suites: "su", cloudflarePlatform: "cfp", cloudflareConfig: "cf", cloudflareOptimization: "cfo" },
          cloudflarePlatform: { activeEra: "pingora-cache-2026-05-04" },
          cloudflareAudit: { ok: true },
          cloudflareOptimizationAudit: { ok: true },
        },
        scoring: { model: "real-world-choice-v1" },
        failures: [],
        rows: [row],
      },
      null,
      2
    )
  );
  const failed = await verifyResultPair(jsonPath);
  assert.equal(failed.ok, false);
  assert(failed.failures.some((failure) => failure.includes("provenanceHash mismatch")));

  const dirtyGit = { ...git, dirty: true, describe: "abc123-dirty" };
  const dirtyJsonPath = path.join(tempDir, "results.v4.demo.json");
  await fs.writeFile(
    dirtyJsonPath,
    JSON.stringify(
      {
        ts: "2026-05-05T00:00:00.000Z",
        ...baseShape,
        runOrder: { seed },
        provenance: {
          git: dirtyGit,
          hashes: { matrix: "m", targets: "t", lockfile: "l", contract: "c", contractsJson: "cj", scoring: "sr", suites: "su", cloudflarePlatform: "cfp", cloudflareConfig: "cf", cloudflareOptimization: "cfo" },
          cloudflarePlatform: { activeEra: "pingora-cache-2026-05-04" },
          cloudflareAudit: { ok: true },
          cloudflareOptimizationAudit: { ok: true },
        },
        scoring: { model: "real-world-choice-v1" },
        failures: [],
        rows: [],
      },
      null,
      2
    )
  );
  await fs.writeFile(path.join(tempDir, "results.v4.demo.md"), "| Git dirty | true |\n");
  const dirtyPolicy = await verifyResultArtifactPolicy(dirtyJsonPath);
  assert.equal(dirtyPolicy.ok, false);
  assert(dirtyPolicy.failures.some((failure) => failure.includes("non-.dirty result path")));

  const dirtySuffixedJsonPath = path.join(tempDir, "results.v4.demo.dirty.json");
  await fs.rename(dirtyJsonPath, dirtySuffixedJsonPath);
  await fs.rename(path.join(tempDir, "results.v4.demo.md"), path.join(tempDir, "results.v4.demo.dirty.md"));
  assert.equal((await verifyResultArtifactPolicy(dirtySuffixedJsonPath)).ok, true);
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}

console.log("verify-results regression tests passed");
