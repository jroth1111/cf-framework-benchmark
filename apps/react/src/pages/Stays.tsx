import { useState, useEffect, useMemo, useTransition } from "react";
import { Link } from "react-router-dom";
import { formatUsd } from "@cf-bench/dataset";

interface Listing {
    id: string;
    title: string;
    city: string;
    country: string;
    pricePerNight: number;
    rating: number;
    reviews: number;
}

interface QueryResult {
    total: number;
    totalPages: number;
    page: number;
    pageSize: number;
    results: Listing[];
}

export function Stays() {
    const [data, setData] = useState<QueryResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [mounted, setMounted] = useState(false);

    const [isPending, startTransition] = useTransition();

    // Defer rendering to next frame for smoother appearance
    useEffect(() => {
        requestAnimationFrame(() => {
            setMounted(true);
        });
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        fetch(`/api/listings?page=${page}&pageSize=12`, { signal: controller.signal })
            .then((r) => r.json() as Promise<QueryResult>)
            .then((d) => {
                setData(d);
                setLoading(false);
            })
            .catch((e) => {
                if (e.name !== "AbortError") setLoading(false);
            });
        return () => controller.abort();
    }, [page]);

    // Handle page changes with useTransition
    const handlePageChange = (newPage: number) => {
        startTransition(() => {
            setPage(newPage);
        });
    };

    // useMemo for stable data reference
    const results = useMemo(() => data?.results || [], [data?.results]);

    return (
        <>
            <h1 className="h1">Stays</h1>
            <p className="muted">Airbnb-style listing index (MPA-like behavior, data from API).</p>

            {!mounted ? (
                <div className="grid-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="card" style={{ padding: 14, minHeight: 200 }}>
                            <div className="skeleton" style={{ height: 24, width: "60%", marginBottom: 12 }} />
                            <div className="skeleton" style={{ height: 16, width: "40%", marginBottom: 8 }} />
                            <div className="skeleton" style={{ height: 20, width: "30%" }} />
                        </div>
                    ))}
                </div>
            ) : (
                <>
                    {loading && !data ? (
                        <div className="grid-3">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="card" style={{ padding: 14, minHeight: 200 }}>
                                    <div className="skeleton" style={{ height: 24, width: "60%", marginBottom: 12 }} />
                                    <div className="skeleton" style={{ height: 16, width: "40%", marginBottom: 8 }} />
                                    <div className="skeleton" style={{ height: 20, width: "30%" }} />
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {data && (
                        <div className="grid-3">
                            {results.map((l) => (
                                <Link
                                    key={l.id}
                                    to={`/stays/${l.id}`}
                                    data-testid="stay-card"
                                    className="card listing-card"
                                    style={{ opacity: isPending ? 0.7 : 1, transition: "opacity 0.2s" }}
                                >
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
                    )}

                    <div className="pagination" style={{ marginTop: 24, display: "flex", gap: 12 }}>
                        <button
                            className="pill"
                            onClick={() => handlePageChange(Math.max(1, page - 1))}
                            disabled={page === 1}
                        >
                            ← Prev
                        </button>
                        <span className="muted">
                            Page {data?.page || 1} of {data?.totalPages || 1}
                        </span>
                        <button
                            className="pill"
                            onClick={() => handlePageChange(data ? Math.min(data.totalPages, page + 1) : page)}
                            disabled={page === data?.totalPages}
                        >
                            Next →
                        </button>
                    </div>
                </>
            )}
        </>
    );
}
