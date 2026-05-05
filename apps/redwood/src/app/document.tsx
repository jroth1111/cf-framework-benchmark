import type { DocumentProps } from "rwsdk/router";

export const Document = ({ children, rw }: DocumentProps) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Redwood Cloudflare Workers benchmark</title>
      <style>{`
        :root {
          color-scheme: light;
          font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
          --bg: #f5f1e8;
          --surface: rgba(255, 252, 246, 0.92);
          --border: #d9cbb4;
          --ink: #1d2b36;
          --muted: #5f6e78;
          --accent: #0d4f59;
          --accent-soft: #d6e7dd;
          --chart: #081320;
        }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: radial-gradient(circle at top, #fff7e6 0%, var(--bg) 52%, #ede3d2 100%); color: var(--ink); }
        body { min-height: 100vh; }
        a { color: inherit; text-decoration: none; }
        button, select { font: inherit; }
        .page-shell { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 56px; }
        .hero { background: linear-gradient(135deg, rgba(13,79,89,0.1), rgba(255,252,246,0.95)); }
        .hero h1 { margin: 10px 0 0; font-size: clamp(2rem, 5vw, 3.7rem); line-height: 0.95; letter-spacing: -0.04em; }
        .eyebrow { margin: 0; color: var(--accent); text-transform: uppercase; letter-spacing: 0.16em; font-size: 0.75rem; font-family: ui-sans-serif, system-ui, sans-serif; }
        .section { margin-top: 18px; }
        .card { background: var(--surface); border: 1px solid var(--border); border-radius: 24px; padding: 18px; box-shadow: 0 18px 40px rgba(29,43,54,0.06); backdrop-filter: blur(8px); }
        .grid { display: grid; gap: 16px; }
        .cols-2 { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
        .cols-3 { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
        .stack { display: grid; gap: 14px; }
        .top-nav { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
        .brand { font-weight: 700; font-family: ui-sans-serif, system-ui, sans-serif; }
        .nav-pills { display: flex; flex-wrap: wrap; gap: 10px; }
        .pill, .action-pill { display: inline-flex; align-items: center; justify-content: center; min-height: 42px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--border); background: rgba(255,255,255,0.75); color: var(--ink); }
        .pill-pill { display: inline-flex; align-items: center; border-radius: 999px; background: var(--accent-soft); color: var(--accent); padding: 4px 10px; font-size: 0.72rem; font-family: ui-sans-serif, system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.08em; }
        .feature-card { min-height: 180px; display: grid; align-content: start; gap: 10px; }
        .feature-card strong, .stay-card strong, .blog-card strong, .media-card strong { font-size: 1.1rem; }
        .stay-card, .blog-card { display: grid; gap: 10px; }
        .stay-meta, .price-row, .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }
        .price { font-size: 1.35rem; }
        .small { font-size: 0.82rem; }
        .muted { color: var(--muted); font-family: ui-sans-serif, system-ui, sans-serif; }
        .rich-html p:first-child { margin-top: 0; }
        .control { display: grid; gap: 6px; min-width: 180px; }
        .control-select { min-height: 42px; border-radius: 14px; border: 1px solid var(--border); background: rgba(255,255,255,0.92); padding: 0 12px; }
        .chart-canvas { width: 100%; height: auto; display: block; border-radius: 18px; border: 1px solid rgba(8,19,32,0.2); background: var(--chart); }
        .media-grid { align-items: start; }
        .media-card { display: grid; gap: 4px; width: 100%; padding: 14px; text-align: left; border-radius: 18px; border: 1px solid var(--border); background: rgba(255,255,255,0.82); }
        .media-player { min-height: 160px; }
        .footer { margin-top: 24px; color: var(--muted); font-size: 0.85rem; font-family: ui-sans-serif, system-ui, sans-serif; }
      `}</style>
      <script
        nonce={rw.nonce}
        dangerouslySetInnerHTML={{
          __html: `
            globalThis.__CF_BENCH__ = globalThis.__CF_BENCH__ || {};
            const hydration = (globalThis.__CF_BENCH__.hydration = globalThis.__CF_BENCH__.hydration || {});
            if (!Number.isFinite(hydration.startMs)) hydration.startMs = performance.now();
          `,
        }}
      />
    </head>
    <body>
      <div className="page-shell">
        {children}
        <p className="footer">Redwood route surface for the Cloudflare Workers benchmark matrix.</p>
      </div>
      <script
        nonce={rw.nonce}
        dangerouslySetInnerHTML={{
          __html: `
            globalThis.__CF_BENCH__ = globalThis.__CF_BENCH__ || {};
            const hydration = (globalThis.__CF_BENCH__.hydration = globalThis.__CF_BENCH__.hydration || {});
            hydration.endMs = performance.now();
          `,
        }}
      />
    </body>
  </html>
);
