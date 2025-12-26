import React, { useState, useEffect, Suspense, lazy } from "react";
import { Layout } from "../components/Layout";

export function Home() {
  const [mounted, setMounted] = useState(false);

  // Defer rendering to next frame for smoother appearance
  useEffect(() => {
    requestAnimationFrame(() => {
      setMounted(true);
    });
  }, []);

  return (
    <Layout title="Framework benchmark harness">
      {!mounted ? (
        <div className="card" style={{ padding: 16, minHeight: 400 }}>
          <div className="skeleton" style={{ height: 28, width: 200, marginBottom: 16 }} />
          <div className="grid cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div className="skeleton" style={{ height: 32, width: 150, marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 16, width: "100%", marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 40, width: 120 }} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid cols-3">
          <div className="card" style={{ padding: 16 }}>
            <h2>SPA-like</h2>
            <p className="muted">Interactive chart with symbol switching (no full reload).</p>
            <a className="btn" href="/chart">Open chart</a>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <h2>App pages</h2>
            <p className="muted">Listings index + detail pages (Airbnb-ish).</p>
            <a className="btn" href="/stays">Browse stays</a>
          </div>
          <div className="card" style={{ padding: 16 }}>
            <h2>SSG blog</h2>
            <p className="muted">Prebuilt blog pages.</p>
            <a className="btn" href="/blog">Read blog</a>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 16, marginTop: 14 }}>
        <p className="muted small">
          This page is rendered client-side in React. For comparisons, run the Playwright bench runner against
          each deployed framework and compare medians.
        </p>
      </div>
    </Layout>
  );
}
