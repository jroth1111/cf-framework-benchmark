import { useParams, Link } from "react-router-dom";
import { formatUsd, getListing } from "@cf-bench/dataset";

export function StayDetail() {
    const { id } = useParams<{ id: string }>();
    const listing = id ? getListing(id) : null;
    if (!listing) return <p>Listing not found</p>;

    return (
        <>
            <Link to="/stays" className="pill" style={{ marginBottom: 16 }}>
                ← Back to listings
            </Link>

            <h1 className="h1">{listing.title}</h1>

            <div className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 300 }}>
                        <p className="muted">
                            {listing.neighborhood}, {listing.city}, {listing.country}
                        </p>
                        <p className="listing-price" style={{ fontSize: 24 }}>
                            {formatUsd(listing.pricePerNight)} <span className="muted">/ night</span>
                        </p>
                        <div className="listing-meta" style={{ marginTop: 8 }}>
                            <span>{listing.rating} ★</span>
                            <span>{listing.reviews} reviews</span>
                            <span>{listing.bedrooms} bed</span>
                            <span>{listing.baths} bath</span>
                            <span>Up to {listing.maxGuests} guests</span>
                        </div>
                        <div className="tags" style={{ marginTop: 12 }}>
                            {listing.tags.map((t) => (
                                <span key={t} className="tag">{t}</span>
                            ))}
                        </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 300 }}>
                        <h3>Host: {listing.hostName}</h3>
                        <p className="muted small">
                            Hosting since {listing.hostSinceISO.slice(0, 4)}
                            {listing.superhost && " • Superhost"}
                        </p>
                    </div>
                </div>

                <h3 style={{ marginTop: 24 }}>About this place</h3>
                <div data-testid="stay-description" dangerouslySetInnerHTML={{ __html: listing.descriptionHtml }} />
            </div>
        </>
    );
}
