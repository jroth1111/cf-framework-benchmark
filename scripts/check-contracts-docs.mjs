#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractsPath = path.join(repoRoot, "contracts", "v5.json");
const v5DocPath = path.join(repoRoot, "docs", "contracts-v5.md");
const v6DocPath = path.join(repoRoot, "docs", "contracts-v6-addendum.md");

const contracts = JSON.parse(await fs.readFile(contractsPath, "utf8"));
const v5Doc = await fs.readFile(v5DocPath, "utf8");
const v6Doc = await fs.readFile(v6DocPath, "utf8");
const docs = `${v5Doc}\n${v6Doc}`;

const failures = [];
function fail(message) {
  failures.push(message);
}

for (const route of contracts.routes) {
  if (route.kind !== "html") continue;
  const isHifi = route.route.startsWith("/hifi/");
  const target = isHifi ? v6Doc : v5Doc;
  const targetName = isHifi ? "contracts-v6-addendum.md" : "contracts-v5.md";

  if (!target.includes(route.route)) {
    fail(`${targetName} missing route mention: ${route.route}`);
  }

  for (const testId of route.requiredTestIds) {
    if (!target.includes(testId)) {
      fail(`${targetName} missing required selector ${testId} for route ${route.route}`);
    }
  }

  if (route.expectedHtmlCache && !docs.includes(route.expectedHtmlCache)) {
    fail(`docs missing expected cache value ${route.expectedHtmlCache} for route ${route.route}`);
  }
}

const apiRoutes = contracts.routes.filter((r) => r.kind === "api" && r.staticSample !== "/api/bench");
for (const route of apiRoutes) {
  if (!v5Doc.includes(route.staticSample)) {
    fail(`contracts-v5.md missing API sample ${route.staticSample}`);
  }
}

if (!v5Doc.includes("/api/bench")) {
  fail(`contracts-v5.md missing /api/bench reference`);
}

if (failures.length) {
  console.error("Contract docs drift detected:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Contract docs match contracts/v5.json (${contracts.routes.length} routes checked).`);
