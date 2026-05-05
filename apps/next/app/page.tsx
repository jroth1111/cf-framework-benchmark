import Link from "next/link";

export default function Page() {
  return (
    <>
      <h1 className="h1">Framework benchmark harness</h1>
      <div className="grid cols-3">
        <div className="card" style={{ padding: 16 }}>
          <h2>SPA-like</h2>
          <p className="muted">Interactive chart with symbol switching.</p>
          <Link className="btn" href="/chart" prefetch={false}>Open chart</Link>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <h2>App pages</h2>
          <p className="muted">Listings index + detail pages.</p>
          <Link className="btn" href="/stays" prefetch={false}>Browse stays</Link>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <h2>SSG blog</h2>
          <p className="muted">Prerendered route content.</p>
          <Link className="btn" href="/blog" prefetch={false}>Read blog</Link>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <h2>Media feed</h2>
          <p className="muted">Feed browsing and player interactions.</p>
          <Link className="btn" href="/media" prefetch={false}>Open media</Link>
        </div>
      </div>
    </>
  );
}
