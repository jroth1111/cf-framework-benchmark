import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(new URL("../bench/package.json", import.meta.url));
const { chromium } = require("playwright");

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

const only = argValue("--only");
const timeoutMs = Number(argValue("--timeout", "15000"));
const headed = process.argv.includes("--headed");
const slowMo = Number(argValue("--slowmo", "0"));

const repoRoot = new URL("..", import.meta.url);
const cfgPath = new URL("bench/bench.config.json", repoRoot);
const cfg = JSON.parse(await fs.readFile(cfgPath, "utf8"));

let frameworks = normalizeFrameworks(cfg.frameworks);
if (only) {
  const allow = new Set(only.split(",").map((s) => s.trim()).filter(Boolean));
  frameworks = frameworks.filter((f) => allow.has(f.name));
}

if (!frameworks.length) {
  console.error("No frameworks found in bench.config.json");
  process.exit(1);
}

const browser = await chromium.launch({ headless: !headed, slowMo: Number.isFinite(slowMo) ? slowMo : 0 });
const failures = [];

async function gotoPath(page, baseUrl, pathname, waitFor) {
  await page.goto(`${baseUrl}${pathname}`, { waitUntil: "domcontentloaded" });
  if (waitFor) await page.waitForSelector(waitFor, { timeout: timeoutMs });
}

async function visitCard(page, baseUrl, selector) {
  const card = page.locator(selector).first();
  await card.waitFor({ timeout: timeoutMs });
  const href = await card.getAttribute("href");
  if (href) {
    const target = new URL(href, baseUrl).toString();
    await page.goto(target, { waitUntil: "domcontentloaded" });
    return;
  }
  await card.click();
}

async function runFramework(framework) {
  const baseUrl = (framework.url || "").replace(/\/$/, "");
  if (!baseUrl) {
    failures.push(`${framework.name}: missing url`);
    return;
  }

  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);

  try {
    console.log(`\n${framework.name}`);

    await gotoPath(page, baseUrl, "/", 'a[href="/stays"]');

    await gotoPath(page, baseUrl, "/stays", "[data-testid=stay-card]");
    await visitCard(page, baseUrl, "[data-testid=stay-card]");
    await page.waitForSelector("[data-testid=stay-description]", { timeout: timeoutMs });

    await gotoPath(page, baseUrl, "/blog", "[data-testid=blog-post-card]");
    await visitCard(page, baseUrl, "[data-testid=blog-post-card]");
    await page.waitForSelector("[data-testid=blog-html]", { timeout: timeoutMs });

    await gotoPath(page, baseUrl, "/chart", "[data-testid=chart-canvas]");
    await page.waitForSelector("[data-testid=symbol-select]", { timeout: timeoutMs });
    await page.waitForSelector("[data-testid=timeframe-select]", { timeout: timeoutMs });
    await page.waitForFunction(() => globalThis.__CF_BENCH__?.chart?.ready === true, { timeout: timeoutMs });
    await page.waitForFunction(
      () =>
        Number.isFinite(globalThis.__CF_BENCH__?.chartCore?.lastDrawMs) &&
        (globalThis.__CF_BENCH__?.chartCore?.drawCount ?? 0) > 0,
      { timeout: timeoutMs }
    );

    await page.route(/\/api\/prices/, (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "forced_error" }),
      });
    });
    const symbolSelect = page.locator("[data-testid=symbol-select]");
    const optionCount = await symbolSelect.locator("option").count();
    if (optionCount > 1) {
      await symbolSelect.selectOption({ index: 1 });
      await page.waitForFunction(
        () => globalThis.__CF_BENCH__?.chart?.ready === true && globalThis.__CF_BENCH__?.chart?.error === true,
        { timeout: timeoutMs }
      );
    }
  } catch (err) {
    failures.push(`${framework.name}: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await context.close();
  }
}

for (const framework of frameworks) {
  await runFramework(framework);
}

await browser.close();

if (failures.length) {
  console.error(`\nSmoke tests failed (${failures.length}):`);
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log("\nSmoke tests passed.");
