import { formatUsd, queryListings } from '@cf-bench/dataset';

export default async function StaysPage() {
  const listings = queryListings({ page: 1, pageSize: 12 }).results;

  return (
    <>
      <title>CF Bench Stays</title>
      <section className="hero">
        <p className="eyebrow">Listings</p>
        <h1 className="h1">Stays</h1>
        <p className="muted">Airbnb-style listing cards served on Cloudflare Workers.</p>
      </section>
      <section className="grid cols-2 section">
        {listings.map((listing) => (
          <a key={listing.id} className="card listing-card" data-testid="stay-card" href={`/stays/${listing.id}`}>
            <strong>{listing.title}</strong>
            <p className="muted small">
              {listing.city}, {listing.country} • {listing.bedrooms} bd • {listing.baths} ba
            </p>
            <p>
              {formatUsd(listing.pricePerNight)} <span className="muted small">/ night</span>
            </p>
            <p className="muted">{listing.summary}</p>
          </a>
        ))}
      </section>
    </>
  );
}

export const getConfig = async () => ({ render: 'static' } as const);
