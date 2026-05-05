import { createHash } from "node:crypto";

export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

export function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : stableStringify(value)).digest("hex");
}

function hashRowsInput(row, gitInfo, runSeed) {
  return {
    version: 1,
    commit: gitInfo?.commit ?? null,
    seed: runSeed,
    framework: row.framework,
    profile: row.profile,
    phase: row.phase,
    scenario: row.scenario,
    iteration: row.iteration,
    status: row.status ?? null,
    ok: row.ok === true,
    skipped: row.skipped === true,
    error: row.error ?? null,
    headers: row.headers ?? null,
    trace: row.trace ?? null,
    earlyHints: row.earlyHints ?? null,
    serverMetrics: row.serverMetrics ?? null,
    clientMetrics: row.clientMetrics ?? null,
    memory: row.memory ?? null,
    synthetic: {
      nav: row.synthetic?.nav ?? null,
      cwv: row.synthetic?.cwv ?? null,
      longTasks: row.synthetic?.longTasks ?? null,
      resources: row.synthetic?.resources ?? null,
      app: row.synthetic?.app ?? null,
    },
    clientNavMs: row.clientNavMs ?? null,
  };
}

export function provenanceHashForRow(row, gitInfo, runSeed) {
  return sha256(hashRowsInput(row, gitInfo, runSeed));
}
