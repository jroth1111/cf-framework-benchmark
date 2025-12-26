import { getListing, formatUsd } from "@cf-bench/dataset";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = getListing(id);

  if (!l) {
    return (
      <>
        <h1 className="h1">Stay not found</h1>
        <div className="card" style={{ padding: 16 }}>
          <p>Unknown listing.</p>
          <a className="pill" href="/stays">Back</a>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="h1">{l.title}</h1>
      <div className="card" style={{ padding: 16 }}>
        <div className="muted small">
          {l.city}, {l.country} • {l.bedrooms} bd • {l.baths} ba • up to {l.maxGuests} guests
        </div>

        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div className="pill">★ {l.rating} <span className="muted">({l.reviews})</span></div>
          <div className="pill"><strong>{formatUsd(l.pricePerNight)}</strong> <span className="muted">/ night</span></div>
          <a className="pill" href="/stays">← Back to results</a>
        </div>

        <div data-testid="stay-description" style={{ marginTop: 14 }} dangerouslySetInnerHTML={{ __html: l.descriptionHtml }} />
      </div>
    </>
  );
}
