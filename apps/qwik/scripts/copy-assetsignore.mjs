import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "public", ".assetsignore");
const dest = path.join(root, "dist", ".assetsignore");

if (!fs.existsSync(src)) {
  console.warn("Missing public/.assetsignore; skipping copy.");
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log("Copied .assetsignore into dist.");
