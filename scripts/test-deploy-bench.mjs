#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { updateTargets } from "./deploy-bench.mjs";

async function withTempDir(run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-bench-deploy-test-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

await withTempDir(async (dir) => {
  const targetsPath = path.join(dir, "targets.live.json");
  await fs.writeFile(
    targetsPath,
    `${JSON.stringify(
      {
        schemaVersion: "1.0.0",
        generatedAt: "2026-03-06T00:00:00.000Z",
        source: "bench/framework-matrix.json",
        targets: [
          { framework: "astro", platform: "workers", url: "https://astro.example.workers.dev" },
          { framework: "next", platform: "workers", url: "https://next.old.example.workers.dev" },
          { framework: "nuxt", platform: "workers", url: "https://nuxt.example.workers.dev" },
        ],
      },
      null,
      2
    )}\n`
  );

  await updateTargets(
    targetsPath,
    [{ name: "astro" }, { name: "next" }, { name: "nuxt" }],
    new Map([["next", "https://next.new.example.workers.dev/"]])
  );

  const doc = await readJson(targetsPath);
  assert.deepEqual(
    doc.targets,
    [
      { framework: "astro", platform: "workers", url: "https://astro.example.workers.dev" },
      { framework: "next", platform: "workers", url: "https://next.new.example.workers.dev" },
      { framework: "nuxt", platform: "workers", url: "https://nuxt.example.workers.dev" },
    ]
  );
});

await withTempDir(async (dir) => {
  const targetsPath = path.join(dir, "targets.live.json");
  let threw = false;
  try {
    await updateTargets(targetsPath, [{ name: "waku" }], new Map());
  } catch (err) {
    threw = true;
    assert.match(String(err?.message || err), /Missing live target URL for waku/);
  }
  assert.equal(threw, true);
});

console.log("deploy-bench regression tests passed");
