import React, { useMemo, useState, useEffect } from "react";
import { listings, formatUsd } from "@cf-bench/dataset";
import { Layout } from "../components/Layout";

function useSearchParams() {
  const sp = new URLSearchParams(window.location.search);
  const city = sp.get("city") ?? "";
  const max = sp.get("max") ?? "";
  return { city, max };
}

export function Stays() {
  const { city, max } = useSearchParams();
  const maxNum = max ? Number(max) : null;
  const [mounted, setMounted] = useState(false);

  const cities = useMemo(() => {
    const s = new Set(listings.map((l) => l.city));
    return ["", ...Array.from(s).sort()];
  }, []);

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (city && l.city !== city) return false;
      if (maxNum != null && Number.isFinite(maxNum) && l.pricePerNight > maxNum) return false;
      return true;
    });
  }, [city, maxNum]);

  // Defer rendering to next frame for smoother appearance
  useEffect(() => {
    requestAnimationFrame(() => {
      setMounted(true);
    });
  }, []);

  return (
    <Layout title="Stays">
      <form method="get" action="/stays" className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div className="grid cols-3">
          <div>
            <div className="small muted">City</div>
            <select className="input" name="city" defaultValue={city}>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c || "Any"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="small muted">Max price</div>
            <input className="input" name="max" defaultValue={max} placeholder="e.g. 250" inputMode="numeric" />
          </div>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button className="btn" type="submit">Apply</button>
          </div>
        </div>
      </form>

      {!mounted ? (
        <div className="grid cols-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card" style={{ padding: 14 }}>
              <div className="skeleton" style={{ height: 24, width: "60%", marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 16, width: "80%", marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 16, width: "40%" }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid cols-2">
          {filtered.map((l) => (
            <a
              key={l.id}
              className="card"
              data-testid="stay-card"
              href={`/stays/${l.id}`}
              style={{ padding: 14, display: "block" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{l.title}</div>
                  <div className="muted small">
                    {l.city}, {l.country} • {l.bedrooms} bd • {l.baths} ba • up to {l.maxGuests} guests
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700 }}>
                    {formatUsd(l.pricePerNight)} <span className="muted small">/ night</span>
                  </div>
                  <div className="muted small">★ {l.rating} ({l.reviews})</div>
                </div>
              </div>
              <div className="muted small" style={{ marginTop: 10 }}>
                {l.summary}
              </div>
            </a>
          ))}
        </div>
      )}
    </Layout>
  );
}
