import { Link } from "react-router-dom";

export function Home() {
    return (
        <>
            <div className="grid cols-3">
                <div className="card">
                    <h2>SPA-like</h2>
                    <p className="muted">Interactive chart with symbol switching.</p>
                    <Link className="btn" to="/chart">Open chart</Link>
                </div>
                <div className="card">
                    <h2>App pages</h2>
                    <p className="muted">Listings index + detail pages.</p>
                    <Link className="btn" to="/stays">Browse stays</Link>
                </div>
                <div className="card">
                    <h2>SSG blog</h2>
                    <p className="muted">Prerendered route content.</p>
                    <Link className="btn" to="/blog">Read blog</Link>
                </div>
                <div className="card">
                    <h2>Media feed</h2>
                    <p className="muted">Feed browsing and player interactions.</p>
                    <Link className="btn" to="/media">Open media</Link>
                </div>
            </div>
        </>
    );
}
