import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <>
      <h1 className="h1">Framework benchmark harness</h1>
      <div className="grid cols-3">
        <div className="card" style={{ padding: 16 }}>
          <h2>SPA-like</h2>
          <p className="muted">Interactive chart with symbol switching.</p>
          <Link className="btn" to="/chart">Open chart</Link>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <h2>App pages</h2>
          <p className="muted">Listings index + detail pages.</p>
          <Link className="btn" to="/stays">Browse stays</Link>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <h2>SSG blog</h2>
          <p className="muted">Static-friendly routes.</p>
          <Link className="btn" to="/blog">Read blog</Link>
        </div>
      </div>
    </>
  );
}
