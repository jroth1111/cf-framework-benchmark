import { useMemo } from "react";
import { Link } from "react-router-dom";
import { formatUsd, queryListings } from "@cf-bench/dataset";

export function Stays() {
    const data = queryListings({ page: 1, pageSize: 12 });
    const results = useMemo(() => data.results, [data.results]);

    return (
        <>
            <h1 className="h1">Stays</h1>
            <p className="muted">Airbnb-style listing index rendered by React on Workers.</p>

            <div className="grid cols-3">
                {results.map((l) => (
                    <Link key={l.id} to={`/stays/${l.id}`} data-testid="stay-card" className="card listing-card">
                        <h3 className="listing-title">{l.title}</h3>
                        <p className="muted small">
                            {l.city}, {l.country}
                        </p>
                        <p className="listing-price">
                            {formatUsd(l.pricePerNight)} <span className="muted">/ night</span>
                        </p>
                        <div className="listing-meta">
                            <span>{l.rating} ★</span>
                            <span>{l.reviews} reviews</span>
                        </div>
                    </Link>
                ))}
            </div>
        </>
    );
}
