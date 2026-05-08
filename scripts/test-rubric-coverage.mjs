#!/usr/bin/env node
// Phase E3 proof test: every scenario in every benchmark suite has a declared
// weight in bench/scoring-rubric.json under the suite's bucket; per-suite
// weights sum to 1.0 ± 1e-6; no `?? 0.2` fallback survives in the runner.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rubricPath = path.join(repoRoot, "bench", "scoring-rubric.json");
const suitesDir = path.join(repoRoot, "bench", "suites");
const runMjsPath = path.join(repoRoot, "bench", "src", "run.mjs");

const rubric = JSON.parse(readFileSync(rubricPath, "utf8"));
const failures = [];
function fail(message) {
  failures.push(message);
}

if (!rubric || typeof rubric !== "object" || !rubric.scenarioWeights) {
  fail("scoring-rubric.json: missing scenarioWeights");
}

const suiteFiles = readdirSync(suitesDir).filter((f) => f.endsWith(".json"));
const suiteScenarios = new Map();
for (const file of suiteFiles) {
  const suiteId = file.replace(/\.json$/, "");
  const suite = JSON.parse(readFileSync(path.join(suitesDir, file), "utf8"));
  const scenarios = (suite.scenarios || []).map((s) => s.name).filter(Boolean);
  suiteScenarios.set(suiteId, scenarios);
}

for (const [suiteId, scenarios] of suiteScenarios) {
  const weights = rubric.scenarioWeights?.[suiteId];
  if (!weights || typeof weights !== "object") {
    fail(`scoring-rubric.json: missing scenarioWeights["${suiteId}"] (suite has ${scenarios.length} scenario(s))`);
    continue;
  }
  for (const scenario of scenarios) {
    if (!Object.prototype.hasOwnProperty.call(weights, scenario)) {
      fail(`scoring-rubric.json: scenarioWeights["${suiteId}"] missing scenario "${scenario}"`);
    }
  }
  const declared = Object.keys(weights);
  for (const declaredScenario of declared) {
    if (!scenarios.includes(declaredScenario)) {
      fail(`scoring-rubric.json: scenarioWeights["${suiteId}"] declares scenario "${declaredScenario}" not present in bench/suites/${suiteId}.json`);
    }
  }
  const sum = Object.values(weights).reduce((s, w) => s + Number(w || 0), 0);
  if (Math.abs(sum - 1) > 1e-6) {
    fail(`scoring-rubric.json: scenarioWeights["${suiteId}"] must sum to 1.0 (got ${sum})`);
  }
}

const declaredSuiteIds = Object.keys(rubric.scenarioWeights ?? {});
for (const declaredSuite of declaredSuiteIds) {
  if (!suiteScenarios.has(declaredSuite)) {
    fail(`scoring-rubric.json: scenarioWeights declares suite "${declaredSuite}" but bench/suites/${declaredSuite}.json does not exist`);
  }
}

const runMjs = readFileSync(runMjsPath, "utf8");
if (/scenarioWeights\[[^\]]+\]\s*\?\?\s*0?\.\d+/.test(runMjs)) {
  fail(`bench/src/run.mjs: scenarioWeights fallback (\`?? 0.X\`) must be removed; missing scenarios must throw`);
}

if (failures.length) {
  console.error("test-rubric-coverage: drift detected:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

const totalScenarios = [...suiteScenarios.values()].reduce((n, s) => n + s.length, 0);
console.log(
  `test-rubric-coverage: ${suiteScenarios.size} suite(s), ${totalScenarios} scenario(s); ` +
  `all per-suite weights sum to 1.0 ± 1e-6; no fallback in runner.`
);
