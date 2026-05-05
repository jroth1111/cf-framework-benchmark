import Link from "next/link";
import { queryListings, formatUsd } from "@cf-bench/dataset";

export default function Page() {
  const listings = queryListings({ page: 1, pageSize: 12 }).results;

  return (
    <>
      <h1 className="h1">Stays</h1>
      <p className="muted">Airbnb-style listing index.</p>

      <div className="grid cols-3">
        {listings.map((l) => (
          <Link
            key={l.id}
            data-testid="stay-card"
            className="card"
            href={`/stays/${l.id}`}
            prefetch={false}
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
