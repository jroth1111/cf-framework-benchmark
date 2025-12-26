import { Link, createFileRoute } from "@tanstack/react-router";
import { formatUsd, getListing } from "@cf-bench/dataset";

export const Route = createFileRoute("/stays/$id")({
  component: StayDetail,
});

function StayDetail() {
  const { id } = Route.useParams();
  const l = getListing(id);

  if (!l) {
    return (
      <>
        <h1 className="h1">Stay not found</h1>
        <div className="card" style={{ padding: 16 }}>
          <p>Unknown listing.</p>
          <Link className="pill" to="/stays">Back</Link>
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
          <Link className="pill" to="/stays">← Back to results</Link>
        </div>

        <div
          data-testid="stay-description"
          style={{ marginTop: 14 }}
          dangerouslySetInnerHTML={{ __html: l.descriptionHtml }}
        />
      </div>
    </>
  );
}
