import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

function argValue(flag, fallback = null) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function normalizeFrameworks(frameworks) {
  if (Array.isArray(frameworks)) return frameworks;
  if (!frameworks) return [];
  return Object.entries(frameworks).map(([name, value]) => {
    if (typeof value === "string") return { name, url: value };
    return { name, ...value };
  });
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const t = idx - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, headers: { accept: "text/html" } });
  } finally {
    clearTimeout(id);
  }
}

async function runLoadTest() {
  const configPath = argValue(
    "--config",
    new URL("../bench.config.json", import.meta.url).pathname
  );
  const outPath = argValue(
    "--out",
    new URL("../load-results.json", import.meta.url).pathname
  );
  const durationMs = Number(argValue("--duration", "15000"));
  const concurrency = Number(argValue("--concurrency", "50"));
  const targetPath = argValue("--path", "/stays");
  const only = argValue("--only");
  const timeoutMs = Number(argValue("--timeout", "10000"));

  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error(`Invalid --duration ${durationMs}`);
  }
  if (!Number.isFinite(concurrency) || concurrency <= 0) {
    throw new Error(`Invalid --concurrency ${concurrency}`);
  }

  const rawConfig = JSON.parse(await fs.readFile(configPath, "utf8"));
  let frameworks = normalizeFrameworks(rawConfig.frameworks);
  if (only) {
    const allow = new Set(only.split(",").map((s) => s.trim()).filter(Boolean));
    frameworks = frameworks.filter((fw) => allow.has(fw.name));
  }

  console.log(`\n🚀 Cloudflare Worker Throughput Test`);
  console.log(`   Target: ${targetPath}`);
  console.log(`   Concurrency: ${concurrency}`);
  console.log(`   Duration: ${(durationMs / 1000).toFixed(1)}s\n`);

  console.log("┌────────────────────┬───────────┬───────────┬───────────┬───────────┐");
  console.log("│ Framework          │ RPS (ok)  │ Total Req │ Error %   │ P95 Lat   │");
  console.log("├────────────────────┼───────────┼───────────┼───────────┼───────────┤");

  const results = [];

  for (const fw of frameworks) {
    const baseUrl = (fw.url || "").replace(/\/$/, "");
    if (!baseUrl) continue;
    const url = `${baseUrl}${targetPath}`;

    const latencies = [];
    const statusCounts = {};
    let total = 0;
    let errors = 0;

    const start = performance.now();
    const endAt = start + durationMs;

    const worker = async () => {
      while (performance.now() < endAt) {
        const reqStart = performance.now();
        total += 1;
        try {
          const res = await fetchWithTimeout(url, timeoutMs);
          await res.text();
          const dur = performance.now() - reqStart;
          if (!res.ok) {
            errors += 1;
            statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;
          } else {
            latencies.push(dur);
          }
        } catch {
          errors += 1;
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, worker));

    const elapsedMs = performance.now() - start;
    const elapsedSec = elapsedMs / 1000;
    const ok = Math.max(0, total - errors);
    const rpsOk = elapsedSec > 0 ? ok / elapsedSec : 0;
    const errorRate = total > 0 ? (errors / total) * 100 : 0;
    const p95 = percentile(latencies, 95);

    const rpsStr = rpsOk.toFixed(1).padStart(9);
    const totalStr = String(total).padStart(9);
    const errStr = `${errorRate.toFixed(1)}%`.padStart(9);
    const p95Str = p95 != null ? `${p95.toFixed(0)}ms` : "—";

    console.log(`│ ${fw.name.padEnd(18)} │ ${rpsStr} │ ${totalStr} │ ${errStr} │ ${p95Str.padStart(9)} │`);

    results.push({
      framework: fw.name,
      url,
      durationMs,
      concurrency,
      totals: { total, ok, errors },
      errorRate,
      latencyMs: {
        p50: percentile(latencies, 50),
        p95,
        p99: percentile(latencies, 99),
      },
      statusCounts,
    });
  }

  console.log("└────────────────────┴───────────┴───────────┴───────────┴───────────┘");

  const output = {
    ts: new Date().toISOString(),
    configPath: path.relative(process.cwd(), configPath),
    targetPath,
    durationMs,
    concurrency,
    results,
  };

  await fs.writeFile(outPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Load test results written to ${path.relative(process.cwd(), outPath)}`);
}

runLoadTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
