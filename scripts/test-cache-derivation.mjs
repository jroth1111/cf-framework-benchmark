#!/usr/bin/env node
// Phase E2 proof test: every cache-control HEADER literal lives inside
// @cf-bench/bench-cache or contracts/v5.json. The `cache: "no-store"` literal
// in client fetches is the web fetch RequestInit standard option, NOT a
// cache-control response header — those are explicitly allowlisted below.
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Files that are allowed to contain cache-control header literals because they
// are either the canonical source of those literals, documentation, or the
// proof test itself.
const ALLOWED_FILES = new Set([
  "contracts/v5.json",
  "contracts/v5.schema.json",
  "packages/bench-cache/src/index.js",
  "packages/bench-cache/src/index.d.ts",
  "packages/bench-cache/README.md",
  "docs/contracts-v5.md",
  "docs/contracts-v6-addendum.md",
  "docs/contracts-v3.md",
  "docs/cloudflare-best-practices.md",
  "bench/cloudflare-platform-eras.json",
  "bench/profiles.json",
  "bench/profiles.schema.json",
  "scripts/test-cache-derivation.mjs",
  "scripts/test-contract-api-cache.mjs",
  "package.json",
]);

// Per-line allowlist for the fetch RequestInit `cache: "no-store"` pattern and
// the chartCache profile mode label that names that option's value. These are
// not cache-control response headers; they configure client-side fetch behavior.
const NON_HEADER_PATTERNS = [
  /\bcache:\s*['"]no-store['"]/,
  /chartCache:\s*['"]no-store['"]/,
  /['"]no-store['"]\s*\|\s*undefined/,
  /mode\s*===\s*['"]no-store['"]/,
];

const LITERAL_RE = /(s-maxage=\d+|stale-while-revalidate|"no-store"|'no-store')/;

const rgArgs = [
  "rg",
  "-n",
  "--no-heading",
  "--color=never",
  "-e",
  's-maxage=\\d+|stale-while-revalidate|"no-store"|\'no-store\'',
  "--glob",
  "!node_modules",
  "--glob",
  "!.svelte-kit",
  "--glob",
  "!.open-next",
  "--glob",
  "!.next",
  "--glob",
  "!.output",
  "--glob",
  "!dist",
  "--glob",
  "!build",
  "--glob",
  "!server",
  "--glob",
  "!.angular",
  "--glob",
  "!.vinxi",
  "--glob",
  "!coverage",
  "--glob",
  "!.turbo",
  "--glob",
  "!*.lock",
  "--glob",
  "!*.lockb",
  "--glob",
  "!pnpm-lock.yaml",
  "--glob",
  "!worker-configuration.d.ts",
  "--glob",
  "!.beads",
  "--glob",
  "!.git",
  ".",
];

let stdout;
try {
  stdout = execSync(rgArgs.map((a) => (/[ "\\]/.test(a) ? `'${a.replace(/'/g, "'\\''")}'` : a)).join(" "), {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
} catch (err) {
  if (err.status === 1) {
    // rg exits 1 on no matches — that means we already pass.
    console.log("test-cache-derivation: 0 cache-control literals outside allowed sources.");
    process.exit(0);
  }
  console.error(`test-cache-derivation: rg failed: ${err.message}`);
  process.exit(2);
}

const violations = [];
for (const line of stdout.split("\n")) {
  if (!line.trim()) continue;
  if (!LITERAL_RE.test(line)) continue;
  const [pathPart] = line.split(":", 1);
  const relPath = pathPart.replace(/^\.\//, "");
  if (ALLOWED_FILES.has(relPath)) continue;
  if (NON_HEADER_PATTERNS.some((re) => re.test(line))) continue;
  violations.push(line);
}

if (violations.length) {
  console.error(
    `test-cache-derivation: ${violations.length} cache-control literal(s) outside @cf-bench/bench-cache and contracts/v5.json:`
  );
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}

console.log("test-cache-derivation: 0 cache-control literals outside allowed sources.");
