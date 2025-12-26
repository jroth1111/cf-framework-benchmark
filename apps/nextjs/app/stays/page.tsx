import Link from "next/link";
import { listings, formatUsd } from "@cf-bench/dataset";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const city = typeof params.city === "string" ? params.city : "";
  const maxRaw = typeof params.max === "string" ? params.max : "";
  const maxNum = maxRaw ? Number(maxRaw) : null;

  const cities = Array.from(new Set(listings.map((l) => l.city))).sort();

  const filtered = listings.filter((l) => {
    if (city && l.city !== city) return false;
    if (maxNum != null && Number.isFinite(maxNum) && l.pricePerNight > maxNum) return false;
    return true;
  });

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
          <Link key={l.id} data-testid="stay-card" className="card" href={`/stays/${l.id}`} style={{ padding: 14, display: "block" }}>
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
