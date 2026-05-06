import { jsxRenderer } from "hono/jsx-renderer";
import { Script } from "honox/server";

const CSS = `
  :root { color-scheme: light; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f7f9fc; color: #16202a; }
  a { color: #0f3d7a; text-decoration: none; }
  .container { width: min(1100px, calc(100% - 32px)); margin: 0 auto; }
  .nav { display: flex; gap: 14px; align-items: center; padding: 14px 0; }
  .nav a { padding: 8px 12px; background: #fff; border: 1px solid #d7dde7; border-radius: 999px; }
  .brand { font-weight: 700; }
  .card { background: #fff; border: 1px solid #d7dde7; border-radius: 12px; padding: 14px; }
  .grid { display: grid; gap: 12px; }
  .grid.cols-2 { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
  .grid.cols-3 { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
  .muted { color: #5c6b7a; }
  .small { font-size: 12px; }
  .h1 { margin: 8px 0 14px; font-size: 30px; line-height: 1.2; }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border: 1px solid #d7dde7; border-radius: 999px; background: #fff; }
  .btn { cursor: pointer; border: 1px solid #d7dde7; border-radius: 10px; padding: 10px 12px; background: #fff; }
  .input { border: 1px solid #c9d2df; border-radius: 8px; padding: 8px 10px; background: #fff; }
  .footer { margin: 22px 0 36px; font-size: 12px; color: #5c6b7a; }
  canvas { background: #0f1620; display: block; width: 100%; height: 100%; border-radius: 12px; border: 1px solid #d7dde7; }
`;

const HYDRATION_START = `(function(){var w=globalThis;w.__CF_BENCH__=w.__CF_BENCH__||{};var h=(w.__CF_BENCH__.hydration=w.__CF_BENCH__.hydration||{});if(!Number.isFinite(h.startMs))h.startMs=performance.now();})();`;
const HYDRATION_END = `(function(){var w=globalThis;w.__CF_BENCH__=w.__CF_BENCH__||{};var h=(w.__CF_BENCH__.hydration=w.__CF_BENCH__.hydration||{});if(h.endMs==null)h.endMs=h.startMs??performance.now();})();`;

export default jsxRenderer(({ children, title, hifi }) => {
	return (
		<html lang="en">
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>{title ?? "HonoX Benchmark"}</title>
				<style dangerouslySetInnerHTML={{ __html: CSS }} />
				<script dangerouslySetInnerHTML={{ __html: HYDRATION_START }} />
				{hifi ? <script async src="/__bench/sdk/maps.js" /> : null}
				{hifi ? <script async src="/__bench/sdk/analytics.js" /> : null}
				<Script src="/app/client.ts" />
			</head>
			<body>
				<header class="container nav">
					<a class="brand" href="/">CF Bench (honox)</a>
					<a href="/stays">Stays</a>
					<a href="/chart">Chart</a>
					<a href="/media">Media</a>
					<a href="/blog">Blog</a>
				</header>
				<main class="container">
					{children}
					<div class="footer">HonoX benchmark — islands architecture (selective hydration).</div>
				</main>
				<script dangerouslySetInnerHTML={{ __html: HYDRATION_END }} />
			</body>
		</html>
	);
});
