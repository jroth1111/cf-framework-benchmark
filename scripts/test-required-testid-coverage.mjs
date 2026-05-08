#!/usr/bin/env node
// Phase E6 proof test 5: every testId referenced by a suite scenario (as a waitFor
// requiredTestId or interaction requiredTestId) is declared in contracts/v5.json's
// requiredTestIds for that route. Catches drift where suites reference testIds not
// in the contract, or where v5 requiredTestIds used as runner wait-targets are
// dropped without removing the suite reference.
//
// Note: v5.json may have requiredTestIds that are "page-presence" checks (verified
// by contract-report.mjs) but not runner wait-targets — those are not required to
// appear in suite scenarios, which is why this check runs in one direction only.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const v5Doc = JSON.parse(await fs.readFile(path.join(repoRoot, "contracts", "v5.json"), "utf8"));
const v5RouteMap = new Map(v5Doc.routes.map((r) => [r.route, new Set(r.requiredTestIds || [])]));

// Collect all testId references from bench/suites/*.json
const suitesDir = path.join(repoRoot, "bench", "suites");
const suiteFiles = (await fs.readdir(suitesDir)).filter((f) => f.endsWith(".json"));

const violations = [];

for (const file of suiteFiles) {
  const doc = JSON.parse(await fs.readFile(path.join(suitesDir, file), "utf8"));
  for (const sc of doc.scenarios || []) {
    const routeId = sc.routeId;
    if (!routeId) continue;
    const declared = v5RouteMap.get(routeId);
    if (!declared) {
      violations.push(`${file}: scenario "${sc.name}" uses routeId "${routeId}" not present in v5 routes`);
      continue;
    }

    // Check waitFor.requiredTestId
    if (sc.waitFor?.requiredTestId) {
      const testId = sc.waitFor.requiredTestId;
      if (!declared.has(testId)) {
        violations.push(
          `${file}: scenario "${sc.name}" waitFor references testId "${testId}" but v5 route "${routeId}" does not declare it in requiredTestIds`
        );
      }
    }

    // Check interaction requiredTestId fields
    for (const interaction of sc.interactions || []) {
      for (const [key, val] of Object.entries(interaction)) {
        if (key === "kind") continue;
        if (val && typeof val === "object" && typeof val.requiredTestId === "string") {
          const testId = val.requiredTestId;
          if (!declared.has(testId)) {
            violations.push(
              `${file}: scenario "${sc.name}" interaction.${key} references testId "${testId}" but v5 route "${routeId}" does not declare it in requiredTestIds`
            );
          }
        }
      }
    }
  }
}

assert.deepEqual(
  violations,
  [],
  `Suite scenarios reference testIds not declared in v5:\n${violations.join("\n")}`
);

// Positive checks: confirm expected testid references exist
const mpaAirbnb = JSON.parse(await fs.readFile(path.join(suitesDir, "mpa_airbnb.json"), "utf8"));
const staysScenario = mpaAirbnb.scenarios.find((s) => s.name === "stays");
assert.ok(staysScenario?.waitFor?.requiredTestId === "stay-card", 'mpa_airbnb "stays" must reference stay-card');

const spaTrading = JSON.parse(await fs.readFile(path.join(suitesDir, "spa_trading_media.json"), "utf8"));
const chartScenario = spaTrading.scenarios.find((s) => s.name === "chart");
assert.ok(chartScenario?.waitFor?.requiredTestId === "chart-canvas", '"chart" scenario must reference chart-canvas');
const chartInteraction = chartScenario?.interactions?.[0];
assert.ok(chartInteraction?.symbolSelect?.requiredTestId === "symbol-select", '"chart" interaction must reference symbol-select');
assert.ok(chartInteraction?.timeframeSelect?.requiredTestId === "timeframe-select", '"chart" interaction must reference timeframe-select');

console.log(`required-testid-coverage: all suite-referenced testIds are declared in v5 requiredTestIds`);
