#!/usr/bin/env node
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { provenanceHashForRow } from "../bench/src/provenance.mjs";

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function fail(message, failures) {
  failures.push(message);
  console.error(`- ${message}`);
}

function parseJsonOrFail(raw, jsonPath, failures) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    fail(`failed to parse JSON at ${jsonPath}: ${err?.message || err}`, failures);
    return null;
  }
}

export async function verifyResultPair(jsonPath, { requireRowHashes = true } = {}) {
  const failures = [];
  const raw = await fs.readFile(jsonPath, "utf8");
  const result = parseJsonOrFail(raw, jsonPath, failures);
  if (result == null) return { ok: false, failures };
  const mdPath = argValue("--md", jsonPath.replace(/\.json$/, ".md"));
  const md = await fs.readFile(mdPath, "utf8").catch(() => null);

  if (!result.provenance?.git?.commit) fail("missing provenance.git.commit", failures);
  if (!result.runOrder?.seed) fail("missing runOrder.seed", failures);
  if (result.provenance?.git?.dirty === true && !path.basename(jsonPath).includes(".dirty.")) {
    fail("dirty provenance written to non-.dirty result path", failures);
  }
  for (const name of ["matrix", "targets", "lockfile", "contract", "contractsJson", "cloudflarePlatform", "cloudflareConfig", "cloudflareOptimization"]) {
    if (!result.provenance?.hashes?.[name]) fail(`missing provenance.hashes.${name}`, failures);
  }
  if (!result.provenance?.cloudflarePlatform?.activeEra) fail("missing provenance.cloudflarePlatform.activeEra", failures);
  if (!result.provenance?.cloudflareAudit?.ok) fail("missing or failing provenance.cloudflareAudit", failures);
  if (!result.provenance?.cloudflareOptimizationAudit?.ok) fail("missing or failing provenance.cloudflareOptimizationAudit", failures);
  if (!result.scoring?.model) fail("missing scoring.model", failures);

  const rows = Array.isArray(result.rows) ? result.rows : [];
  if (!rows.length) fail("missing rows", failures);
  for (const row of rows) {
    if (!row.provenanceHash) {
      if (requireRowHashes) fail(`row missing provenanceHash: ${row.framework}/${row.profile}/${row.phase}/${row.scenario}/${row.iteration}`, failures);
      continue;
    }
    const expected = provenanceHashForRow(row, result.provenance?.git, result.runOrder?.seed);
    if (row.provenanceHash !== expected) {
      fail(`row provenanceHash mismatch: ${row.framework}/${row.profile}/${row.phase}/${row.scenario}/${row.iteration}`, failures);
    }
  }

  if (md != null) {
    const requiredSnippets = [
      result.ts,
      result.runOrder?.seed,
      result.provenance?.git?.commit,
      result.scoring?.model,
    ].filter(Boolean);
    for (const snippet of requiredSnippets) {
      if (!md.includes(String(snippet))) fail(`markdown missing JSON-derived snippet: ${snippet}`, failures);
    }
    const failureLine = `Failures: ${Array.isArray(result.failures) ? result.failures.length : 0}`;
    if (!md.includes(failureLine)) fail(`markdown missing failure count line: ${failureLine}`, failures);
  } else {
    fail(`missing markdown pair: ${mdPath}`, failures);
  }

  return { ok: failures.length === 0, failures };
}

export async function verifyResultArtifactPolicy(jsonPath) {
  const failures = [];
  const raw = await fs.readFile(jsonPath, "utf8");
  const result = parseJsonOrFail(raw, jsonPath, failures);
  if (result == null) return { ok: false, failures };
  const base = path.basename(jsonPath);
  const mdPath = jsonPath.replace(/\.json$/, ".md");
  const md = await fs.readFile(mdPath, "utf8").catch(() => null);
  const dirty = result.provenance?.git?.dirty === true;

  if (dirty && !base.includes(".dirty.")) {
    fail("dirty provenance written to non-.dirty result path", failures);
  }
  if (!dirty && base.includes(".dirty.")) {
    fail("clean provenance written to .dirty result path", failures);
  }
  if (md == null) {
    fail(`missing markdown pair: ${mdPath}`, failures);
  } else if (dirty && !/\|\s*Git dirty\s*\|\s*(?:\*\*)?true\b/i.test(md)) {
    fail("dirty JSON provenance is not disclosed in markdown pair", failures);
  }

  return { ok: failures.length === 0, failures };
}

function trackedResultJsonPaths() {
  const out = execFileSync("git", ["ls-files", "bench/results*.json"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  return out.split(/\r?\n/).filter(Boolean);
}

async function localResultJsonPaths() {
  const entries = await fs.readdir("bench").catch((err) => {
    if (err?.code === "ENOENT") return [];
    throw err;
  });
  return entries
    .filter((entry) => /^results.*\.json$/.test(entry))
    .map((entry) => path.join("bench", entry))
    .sort((a, b) => a.localeCompare(b));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const jsonPath = argValue("--json", process.argv[2]);
  if (hasFlag("--all-tracked") || hasFlag("--all-local")) {
    const paths = hasFlag("--all-local") ? await localResultJsonPaths() : trackedResultJsonPaths();
    const failures = [];
    for (const resultPath of paths) {
      const result = hasFlag("--artifact-policy")
        ? await verifyResultArtifactPolicy(resultPath)
        : await verifyResultPair(resultPath, { requireRowHashes: !hasFlag("--allow-legacy") });
      if (!result.ok) {
        failures.push(...result.failures.map((failure) => `${resultPath}: ${failure}`));
      }
    }
    if (failures.length) {
      console.error(`Result artifact verification failed (${failures.length}).`);
      process.exit(1);
    }
    console.log(`Result artifact verification passed (${paths.length} result JSON files).`);
  } else if (!jsonPath) {
    console.error("Usage: node scripts/verify-results.mjs --json bench/results.v4.<suite>.json");
    process.exit(2);
  } else {
    const result = await verifyResultPair(jsonPath, {
      requireRowHashes: !hasFlag("--allow-legacy"),
    });
    if (!result.ok) {
      console.error(`Result verification failed (${result.failures.length}).`);
      process.exit(1);
    }
    console.log(`Result verification passed: ${jsonPath}`);
  }
}
