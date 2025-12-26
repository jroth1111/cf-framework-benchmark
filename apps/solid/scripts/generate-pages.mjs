import fs from "node:fs";
import path from "node:path";
import { listings, blogPosts } from "@cf-bench/dataset";

const root = path.resolve(process.cwd());
const pagesDir = path.join(root, "pages");

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}
function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}
function writeFile(p, content) {
  mkdirp(path.dirname(p));
  fs.writeFileSync(p, content, "utf-8");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layoutHtml({ heading, contentHtml, footerHtml }) {
  return `
    <div>
      <header class="container nav">
        <a class="brand" href="/">CF Bench</a>
        <nav class="links">
          <a class="pill" href="/stays">Stays</a>
          <a class="pill" href="/chart">Chart</a>
          <a class="pill" href="/blog">Blog</a>
        </nav>
      </header>

      <main class="container">
        <h1 class="h1">${escapeHtml(heading)}</h1>
        ${contentHtml}
        <div class="footer">${footerHtml}</div>
      </main>
    </div>
  `.trim();
}

function html({ docTitle, entry, props, bodyHtml, includeCss }) {
  const propsScript = props ? `<script>window.__PAGE_PROPS__=${JSON.stringify(props)};</script>` : "";
  const cssLink = includeCss ? `<link rel="stylesheet" href="/src/main.css" />` : "";
  const appHtml = bodyHtml ? bodyHtml : `<div id="app"></div>`;
  const script = entry ? `<script type="module" src="/src/entries/${entry}.tsx"></script>` : "";
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(docTitle)}</title>
    ${cssLink}
  </head>
  <body>
    ${appHtml}
    ${propsScript}
    ${script}
  </body>
</html>`;
}

rmrf(pagesDir);
mkdirp(pagesDir);

const footerHtml = 'SolidJS + Vite variant • <span class="kbd">/chart</span> is SPA-like, blog is SSG pages, stays are multi-page routes.';

writeFile(path.join(pagesDir, "index.html"), html({ docTitle: "CF Bench — Solid", entry: "home" }));
writeFile(path.join(pagesDir, "stays", "index.html"), html({ docTitle: "Stays — Solid", entry: "stays" }));
writeFile(path.join(pagesDir, "chart", "index.html"), html({ docTitle: "Chart — Solid", entry: "chart" }));

for (const l of listings) {
  writeFile(
    path.join(pagesDir, "stays", l.id, "index.html"),
    html({ docTitle: `${l.title} — Solid`, entry: "stay", props: { id: l.id } })
  );
}

const blogCards = blogPosts.map((p) => `
  <a class="card" data-testid="blog-post-card" href="/blog/${p.slug}" style="padding:14px;display:block">
    <div style="font-weight:700">${escapeHtml(p.title)}</div>
    <div class="muted small">${escapeHtml(p.dateISO)} • ${p.readingMinutes} min read</div>
    <div class="muted small" style="margin-top:10px">${escapeHtml(p.excerpt)}</div>
  </a>
`).join("");

const blogIndexBody = layoutHtml({
  heading: "Blog",
  contentHtml: `<div class="grid cols-2">${blogCards}</div>`,
  footerHtml,
});
writeFile(
  path.join(pagesDir, "blog", "index.html"),
  html({ docTitle: "Blog — Solid", bodyHtml: blogIndexBody, includeCss: true })
);

for (const p of blogPosts) {
  const postBody = layoutHtml({
    heading: p.title,
    contentHtml: `
      <div class="muted small">${escapeHtml(p.dateISO)} • ${p.readingMinutes} min read</div>
      <div class="card" style="padding:16px;margin-top:14px">
        <div data-testid="blog-html">${p.html}</div>
      </div>
      <div style="margin-top:14px">
        <a class="pill" href="/blog">← Back to blog</a>
      </div>
    `,
    footerHtml,
  });

  writeFile(
    path.join(pagesDir, "blog", p.slug, "index.html"),
    html({ docTitle: `${p.title} — Solid`, bodyHtml: postBody, includeCss: true })
  );
}

console.log(`Generated pages in ${pagesDir}`);
