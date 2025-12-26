import React from "react";
import { getListing, formatUsd } from "@cf-bench/dataset";
import { Layout } from "../components/Layout";

declare global {
  interface Window {
    __PAGE_PROPS__?: { id?: string };
  }
}

export function StayDetail() {
  const id = window.__PAGE_PROPS__?.id ?? "";
  const l = getListing(id);

  if (!l) {
    return (
      <Layout title="Stay not found">
        <p>Unknown listing.</p>
        <a className="pill" href="/stays">Back</a>
      </Layout>
    );
  }

  return (
    <Layout title={l.title}>
      <div className="card" style={{ padding: 16 }}>
        <div className="muted small">
          {l.city}, {l.country} • {l.bedrooms} bd • {l.baths} ba • up to {l.maxGuests} guests
        </div>

        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div className="pill">★ {l.rating} <span className="muted">({l.reviews})</span></div>
          <div className="pill"><strong>{formatUsd(l.pricePerNight)}</strong> <span className="muted">/ night</span></div>
          <a className="pill" href="/stays">← Back to results</a>
        </div>

        <div data-testid="stay-description" style={{ marginTop: 14 }} dangerouslySetInnerHTML={{ __html: l.descriptionHtml }} />
      </div>
    </Layout>
  );
}
