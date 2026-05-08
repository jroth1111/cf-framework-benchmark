#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const smokePath = path.join(repoRoot, "scripts", "smoke.mjs");
const contractPath = path.join(repoRoot, "contracts", "v5.json");

const smokeSource = await fs.readFile(smokePath, "utf8");
const contractV5 = JSON.parse(await fs.readFile(contractPath, "utf8"));

const requiredByRoute = new Map(
  contractV5.routes.map((entry) => [entry.route, new Set(entry.requiredTestIds ?? [])])
);

// 1. Refactor proof: smoke.mjs must not contain any [data-testid=...] literal
//    outside the contractTestIdSelector helper that builds it from a verified id.
const literalLines = smokeSource
  .split("\n")
  .map((line, index) => ({ line, lineNumber: index + 1 }))
  .filter(({ line }) => /\[data-testid=/.test(line))
  .filter(({ line }) => !/return\s+`\[data-testid=\$\{testId\}\]`;/.test(line));

assert.deepEqual(
  literalLines,
  [],
  `smoke.mjs still contains hardcoded [data-testid=...] literal(s):\n${literalLines.map(({ lineNumber, line }) => `  ${lineNumber}: ${line.trim()}`).join("\n")}`
);

// 2. Each contractTestIdSelector("/route", "id") must reference a testId present
//    in contracts/v5.json#routes[route].requiredTestIds.
const callRe = /contractTestIdSelector\(\s*"(\/[\w/-]*)"\s*,\s*"([a-z][a-z0-9-]*)"\s*\)/g;
const calls = [];
for (const match of smokeSource.matchAll(callRe)) {
  calls.push({ route: match[1], testId: match[2] });
}
assert.ok(
  calls.length > 0,
  "expected smoke.mjs to use contractTestIdSelector at least once after the refactor"
);

for (const { route, testId } of calls) {
  const expected = requiredByRoute.get(route);
  assert.ok(
    expected,
    `smoke.mjs references unknown route ${route} in contractTestIdSelector — not present in contracts/v5.json#routes[].route`
  );
  assert.ok(
    expected.has(testId),
    `smoke.mjs references testId "${testId}" for ${route} but contracts/v5.json#requiredTestIds[${route}] = [${Array.from(expected).join(", ")}]`
  );
}

// 3. Each /chart and /media requiredTestId in contracts/v5.json must be exercised
//    by smoke.mjs via contractTestIdSelector — no orphans.
for (const route of ["/chart", "/media"]) {
  const expected = requiredByRoute.get(route);
  assert.ok(expected, `contracts/v5.json missing route ${route}`);
  for (const id of expected) {
    const used = calls.some((call) => call.route === route && call.testId === id);
    assert.ok(
      used,
      `smoke.mjs does not exercise ${route}'s requiredTestId "${id}" via contractTestIdSelector — interaction harness drifted from the contract`
    );
  }
}

// 4. Runtime check: importing smoke.mjs's helper-fed top-level constants would
//    require running the harness, which spawns Playwright. Instead, replicate
//    the helper's contract assertion here so we catch a deliberately-broken
//    contracts/v5.json fixture independent of the source-grep above.
const tmpDir = await fs.mkdtemp(path.join(await fs.realpath(repoRoot), ".tmp-smoke-contract-"));
try {
  const broken = JSON.parse(JSON.stringify(contractV5));
  const chartEntry = broken.routes.find((r) => r.route === "/chart");
  chartEntry.requiredTestIds = chartEntry.requiredTestIds.filter((id) => id !== "chart-canvas");
  const fixture = path.join(tmpDir, "broken-v5.json");
  await fs.writeFile(fixture, JSON.stringify(broken, null, 2));
  const fixtureRequired = new Map(
    broken.routes.map((entry) => [entry.route, new Set(entry.requiredTestIds ?? [])])
  );
  const stillReferenced = calls.some(
    (call) => call.route === "/chart" && call.testId === "chart-canvas"
  );
  assert.ok(stillReferenced, "expected smoke.mjs to reference chart-canvas (sanity check)");
  const violation = !fixtureRequired.get("/chart").has("chart-canvas");
  assert.ok(
    violation,
    "broken fixture should drop chart-canvas from /chart.requiredTestIds"
  );
} finally {
  await fs.rm(tmpDir, { recursive: true, force: true });
}

console.log(
  `smoke-contract-selectors: ${calls.length} contractTestIdSelector reference(s) across ${new Set(calls.map((c) => c.route)).size} route(s) verified against contracts/v5.json`
);
