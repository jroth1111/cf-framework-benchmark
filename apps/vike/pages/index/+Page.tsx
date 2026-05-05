export default function Page() {
  return (
    <>
      <h1 className="h1">Framework benchmark harness</h1>
      <p className="muted">Shared benchmark routes for stays, blog, chart, and media on Cloudflare Workers.</p>
      <div className="grid cols-3 hero-grid">
        <a className="card listing-card" href="/stays">
          <h2>MPA listing flow</h2>
          <p className="muted">Listing index + detail routes with SSR markers in raw HTML.</p>
          <span className="pill">Open stays</span>
        </a>
        <a className="card listing-card" href="/chart">
          <h2>SPA chart flow</h2>
          <p className="muted">Interactive chart controls with client-side benchmark markers.</p>
          <span className="pill">Open chart</span>
        </a>
        <a className="card listing-card" href="/media">
          <h2>Media feed flow</h2>
          <p className="muted">Raw HTML selectors plus client-side open/next benchmark markers.</p>
          <span className="pill">Open media</span>
        </a>
      </div>
    </>
  );
}
