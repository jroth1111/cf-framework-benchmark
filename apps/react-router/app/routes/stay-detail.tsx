import { Link, data } from "react-router";
import type { Route } from "./+types/stay-detail";
import { getListing } from "../lib/data";

export function loader({ params }: Route.LoaderArgs) {
  const listing = getListing(params.id || "");
  if (!listing) {
    throw data("Not found", { status: 404 });
  }
  return { listing };
}

export default function StayDetailRoute({ loaderData }: Route.ComponentProps) {
  const { listing } = loaderData;
  return (
    <>
      <Link className="pill" to="/stays">
        ← Back to stays
      </Link>
      <h1 className="h1">{listing.title}</h1>
      <div className="small muted">
        {listing.city}, {listing.country} • {listing.neighborhood}
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div data-testid="stay-description" dangerouslySetInnerHTML={{ __html: listing.descriptionHtml }} />
      </div>
    </>
  );
}
