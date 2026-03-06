import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { blogPosts, queryListings } from "@cf-bench/dataset";
import { App } from "../src/App.tsx";

const root = path.resolve(process.cwd());
const pagesDir = path.join(root, "pages");

function rmrf(target) {
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

function mkdirp(target) {
  fs.mkdirSync(target, { recursive: true });
}

function writeFile(target, content) {
  mkdirp(path.dirname(target));
  fs.writeFileSync(target, content, "utf8");
}

function renderPage(route) {
  const html = renderToString(
    React.createElement(MemoryRouter, { initialEntries: [route] }, React.createElement(App))
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CF Bench React</title>
    <link rel="stylesheet" href="/src/main.css" />
    <script>
      (function () {
        var w = window;
        w.__CF_BENCH__ = w.__CF_BENCH__ || {};
        var h = (w.__CF_BENCH__.hydration = w.__CF_BENCH__.hydration || {});
        if (h.startMs == null) h.startMs = performance.now();
      })();
    </script>
  </head>
  <body>
    <div id="root">${html}</div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
}

rmrf(pagesDir);
mkdirp(pagesDir);

const stayRoutes = queryListings({ page: 1, pageSize: 12 }).results.map((listing) => `/stays/${listing.id}`);
const blogRoutes = blogPosts.map((post) => `/blog/${post.slug}`);

const staticRoutes = [
  "/",
  "/stays",
  "/chart",
  "/media",
  "/blog",
  ...stayRoutes,
  ...blogRoutes,
];

for (const route of staticRoutes) {
  const file = route === "/" ? path.join(pagesDir, "index.html") : path.join(pagesDir, route, "index.html");
  writeFile(file, renderPage(route));
}

console.log(`Generated React benchmark pages in ${pagesDir}`);
