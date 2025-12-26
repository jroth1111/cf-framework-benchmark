import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const buildDir = path.join(distDir, "build");

async function findEntryFile() {
  const entries = await fs.readdir(buildDir);
  for (const name of entries) {
    if (!name.endsWith(".js")) continue;
    const p = path.join(buildDir, name);
    const content = await fs.readFile(p, "utf8");
    if (content.includes("entry_cloudflarePages") && content.includes("fetch")) {
      return name;
    }
  }
  return null;
}

const entryFile = await findEntryFile();
if (!entryFile) {
  throw new Error("Could not locate the Cloudflare Pages entry chunk in dist/build");
}

const entryPath = path.join(distDir, "entry.cloudflare-pages.js");
const workerPath = path.join(distDir, "_worker.js");
const rel = `./build/${entryFile}`;

await fs.writeFile(entryPath, `export { default, fetch } from "${rel}";\n`);
await fs.writeFile(workerPath, 'import { fetch } from "./entry.cloudflare-pages.js"; export default { fetch };\n');
