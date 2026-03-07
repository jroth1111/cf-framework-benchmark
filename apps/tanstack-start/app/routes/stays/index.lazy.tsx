import { Link, createLazyFileRoute } from "@tanstack/react-router";
import { formatUsd } from "@cf-bench/dataset";

export const Route = createLazyFileRoute("/stays/")({
  component: Stays,
});

function Stays() {
  const data = Route.useLoaderData();
  const { city, maxRaw, cities, filtered } = data;

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

      <div className="grid cols-2">
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
    </>
  );
}
