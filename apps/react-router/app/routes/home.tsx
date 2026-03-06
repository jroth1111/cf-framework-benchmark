import { Link } from "react-router";
import { formatUsd, listings } from "../lib/data";

export default function HomeRoute() {
  return (
    <>
      <h1 className="h1">Cloudflare Framework Benchmark</h1>
      <div className="grid cols-3">
        <div className="card">
          <h2>MPA stays flow</h2>
          <p className="muted">Listing index and detail routes rendered by React Router on Workers.</p>
          <p>
            <Link className="pill" to="/stays">
              Open stays
            </Link>
          </p>
        </div>
        <div className="card">
          <h2>SPA chart flow</h2>
          <p className="muted">Interactive chart controls and canvas measurements.</p>
          <p>
            <Link className="pill" to="/chart">
              Open chart
            </Link>
          </p>
        </div>
        <div className="card">
          <h2>Media flow</h2>
          <p className="muted">Open and next interactions with benchmark markers.</p>
          <p>
            <Link className="pill" to="/media">
              Open media
            </Link>
          </p>
        </div>
      </div>

      <h2 style={{ marginTop: 24 }}>Featured stays</h2>
      <div className="grid cols-3">
        {listings.slice(0, 6).map((listing) => (
          <Link key={listing.id} className="card" to={`/stays/${listing.id}`}>
            <div style={{ fontWeight: 700 }}>{listing.title}</div>
            <div className="small muted">
              {listing.city}, {listing.country}
            </div>
            <div style={{ marginTop: 8 }}>
              <strong>{formatUsd(listing.pricePerNight)}</strong> <span className="muted small">/ night</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
