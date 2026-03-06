import { Link } from "react-router";
import type { Route } from "./+types/stays";
import { formatUsd, queryListings } from "../lib/data";

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");
  return queryListings({ page, pageSize: 12 });
}

export function shouldRevalidate({
  currentUrl,
  nextUrl,
}: Route.ShouldRevalidateArgs) {
  return currentUrl.search !== nextUrl.search;
}

export default function StaysRoute({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <h1 className="h1">Stays</h1>
      <p className="muted">Airbnb-style listing index served by route loaders on Workers.</p>
      <div className="grid cols-3" style={{ marginTop: 12 }}>
        {loaderData.results.map((listing) => (
          <Link
            key={listing.id}
            prefetch="intent"
            to={`/stays/${listing.id}`}
            data-testid="stay-card"
            className="card"
          >
            <div style={{ fontWeight: 700 }}>{listing.title}</div>
            <div className="small muted">
              {listing.city}, {listing.country} • {listing.bedrooms} bd • {listing.baths} ba
            </div>
            <div style={{ marginTop: 8 }}>
              <strong>{formatUsd(listing.pricePerNight)}</strong> <span className="muted small">/ night</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
