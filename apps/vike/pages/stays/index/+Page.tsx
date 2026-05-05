import { formatUsd, queryListings } from "../../../src/bench";

export default function Page() {
  const results = queryListings({ page: 1, pageSize: 12 }).results;

  return (
    <>
      <h1 className="h1">Stays</h1>
      <p className="muted">Airbnb-style listing index served on Cloudflare Workers.</p>
      <div className="grid cols-3">
        {results.map((listing) => (
          <a key={listing.id} href={`/stays/${listing.id}`} data-testid="stay-card" className="card listing-card">
            <h2 className="listing-title">{listing.title}</h2>
            <p className="muted small">
              {listing.city}, {listing.country}
            </p>
            <p>
              <strong>{formatUsd(listing.pricePerNight)}</strong> <span className="muted">/ night</span>
            </p>
            <div className="listing-meta muted small">
              <span>{listing.rating} ★</span>
              <span>{listing.reviews} reviews</span>
              <span>{listing.bedrooms} bd</span>
              <span>{listing.baths} ba</span>
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
