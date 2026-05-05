import { Link } from "react-router";

export default function HomeRoute() {
  return (
    <>
      <h1 className="h1">Framework benchmark harness</h1>
      <div className="grid cols-3">
        <div className="card">
          <h2>SPA-like</h2>
          <p className="muted">Interactive chart with symbol switching.</p>
          <p>
            <Link className="btn" to="/chart">
              Open chart
            </Link>
          </p>
        </div>
        <div className="card">
          <h2>App pages</h2>
          <p className="muted">Listings index + detail pages.</p>
          <p>
            <Link className="btn" prefetch="intent" to="/stays">
              Browse stays
            </Link>
          </p>
        </div>
        <div className="card">
          <h2>SSG blog</h2>
          <p className="muted">Prerendered route content.</p>
          <p>
            <Link className="btn" prefetch="intent" to="/blog">
              Read blog
            </Link>
          </p>
        </div>
        <div className="card">
          <h2>Media feed</h2>
          <p className="muted">Feed browsing and player interactions.</p>
          <p>
            <Link className="btn" to="/media">
              Open media
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
