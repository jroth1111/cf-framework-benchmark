import { Link } from "react-router-dom";
import { listings, formatUsd } from "@cf-bench/dataset";

export function Home() {
    const featured = listings.slice(0, 6);

    return (
        <>
            <h1 className="h1">CF Framework Benchmark</h1>

            <div className="card" style={{ padding: 16 }}>
                <h2>What is this?</h2>
                <p className="muted">
                    This is a React SPA (single-page application) variant using react-router-dom for client-side navigation.
                    All navigation between pages happens client-side without full page reloads.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                    <Link className="pill" to="/chart">Open chart</Link>
                    <Link className="pill" to="/media">Open media feed</Link>
                    <Link className="pill" to="/blog">Read blog</Link>
                </div>
            </div>

            <h2 style={{ marginTop: 24 }}>Featured Stays</h2>
            <div className="grid cols-3">
                {featured.map((l) => (
                    <Link key={l.id} to={`/stays/${l.id}`} className="card listing-card">
                        <h3 className="listing-title">{l.title}</h3>
                        <p className="muted small">
                            {l.city}, {l.country}
                        </p>
                        <p className="listing-price">
                            {formatUsd(l.pricePerNight)} <span className="muted">/ night</span>
                        </p>
                        <div className="listing-meta">
                            <span>{l.rating} ★</span>
                            <span>{l.reviews} reviews</span>
                        </div>
                    </Link>
                ))}
            </div>
        </>
    );
}
