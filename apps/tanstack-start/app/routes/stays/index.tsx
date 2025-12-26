import { Link, createFileRoute } from "@tanstack/react-router";
import { listings, formatUsd } from "@cf-bench/dataset";
import { useState, useEffect, useTransition } from "react";

export const Route = createFileRoute("/stays/")({
  loader: ({ request, location }) => {
    const locationUrl =
      location?.href ||
      (location?.pathname ? `${location.pathname}${location.search ?? ""}` : null);
    const url = new URL(request?.url ?? locationUrl ?? "/stays", "http://localhost");
    const city = url.searchParams.get("city") ?? "";
    const maxRaw = url.searchParams.get("max") ?? "";
    const maxNum = maxRaw ? Number(maxRaw) : null;

    const cities = Array.from(new Set(listings.map((l) => l.city))).sort();
    const filtered = listings.filter((l) => {
      if (city && l.city !== city) return false;
      if (maxNum != null && Number.isFinite(maxNum) && l.pricePerNight > maxNum) return false;
      return true;
    });

    return { city, maxRaw, cities, filtered };
  },
  component: Stays,
});

function Stays() {
  const data = Route.useLoaderData();
  const { city, maxRaw, cities, filtered } = data;
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Defer rendering to next frame for smoother appearance
  useEffect(() => {
    requestAnimationFrame(() => {
      setMounted(true);
    });
  }, []);

  return (
    <>
      <h1 className="h1">Stays</h1>

      <form method="get" action="/stays" className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div className="grid cols-3">
          <div>
            <div className="small muted">City</div>
            <select className="input" name="city" defaultValue={city}>
              <option value="">Any</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="small muted">Max price</div>
            <input className="input" name="max" defaultValue={maxRaw} placeholder="e.g. 250" inputMode="numeric" />
          </div>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button className="btn" type="submit">Apply</button>
          </div>
        </div>
      </form>

      {!mounted ? (
        <div className="grid cols-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card" style={{ padding: 14, minHeight: 200 }}>
              <div className="skeleton" style={{ height: 24, width: "60%", marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 16, width: "40%", marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 20, width: "30%" }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid cols-2" style={{ opacity: isPending ? 0.7 : 1, transition: "opacity 0.2s" }}>
          {filtered.map((l) => (
            <Link key={l.id} data-testid="stay-card" className="card" to={`/stays/${l.id}`} style={{ padding: 14, display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{l.title}</div>
                  <div className="muted small">
                    {l.city}, {l.country} • {l.bedrooms} bd • {l.baths} ba • up to {l.maxGuests} guests
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700 }}>{formatUsd(l.pricePerNight)} <span className="muted small">/ night</span></div>
                  <div className="muted small">★ {l.rating} ({l.reviews})</div>
                </div>
              </div>
              <div className="muted small" style={{ marginTop: 10 }}>{l.summary}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
