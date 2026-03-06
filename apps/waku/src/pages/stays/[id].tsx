import { formatUsd, getListing, listings } from '@cf-bench/dataset';
import type { PageProps } from 'waku/router';

export default async function StayDetailPage({ id }: PageProps<'/stays/[id]'>) {
  const listing = getListing(id);

  if (!listing) {
    return (
      <>
        <title>Stay not found</title>
        <h1 className="h1">Stay not found</h1>
        <a className="pill section" href="/stays">
          Back to stays
        </a>
      </>
    );
  }

  return (
    <>
      <title>{listing.title}</title>
      <a className="pill" href="/stays">
        Back to stays
      </a>
      <section className="hero section">
        <p className="eyebrow">Listing detail</p>
        <h1 className="h1">{listing.title}</h1>
        <p className="muted">
          {listing.neighborhood}, {listing.city}, {listing.country}
        </p>
      </section>
      <section className="card">
        <p>
          {formatUsd(listing.pricePerNight)} <span className="muted small">/ night</span>
        </p>
        <p className="muted small">
          {listing.rating} ★ • {listing.reviews} reviews • {listing.maxGuests} guests
        </p>
        <div className="tags section">
          {listing.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
        <div className="section" data-testid="stay-description" dangerouslySetInnerHTML={{ __html: listing.descriptionHtml }} />
      </section>
    </>
  );
}

export const getConfig = async () =>
  ({
    render: 'static',
    staticPaths: listings.map((listing) => listing.id),
  }) as const;
