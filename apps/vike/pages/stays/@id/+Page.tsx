import { formatUsd } from "../../../src/bench";
import { useData } from "vike-react/useData";
import type { Data } from "./+data";

export default function Page() {
  const { listing } = useData<Data>();

  if (!listing) {
    return (
      <>
        <h1 className="h1">Stay not found</h1>
        <a className="pill back-link" href="/stays">
          Back to stays
        </a>
      </>
    );
  }

  return (
    <>
      <a className="pill back-link" href="/stays">
        Back to stays
      </a>
      <h1 className="h1">{listing.title}</h1>
      <div className="card stay-detail">
        <p className="muted">
          {listing.neighborhood}, {listing.city}, {listing.country}
        </p>
        <p>
          <strong>{formatUsd(listing.pricePerNight)}</strong> <span className="muted">/ night</span>
        </p>
        <div className="listing-meta muted small">
          <span>{listing.rating} ★</span>
          <span>{listing.reviews} reviews</span>
          <span>{listing.bedrooms} bed</span>
          <span>{listing.baths} bath</span>
          <span>Up to {listing.maxGuests} guests</span>
        </div>
        <div className="tags" style={{ marginTop: 12 }}>
          {listing.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
        <h2>About this place</h2>
        <div data-testid="stay-description" dangerouslySetInnerHTML={{ __html: listing.descriptionHtml }} />
      </div>
    </>
  );
}
