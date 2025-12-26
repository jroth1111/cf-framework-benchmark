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
        <a class="pill" href="/stays">Back</a>
      </Layout>
    );
  }

  return (
    <Layout title={l.title}>
      <div class="card" style="padding:16px">
        <div class="muted small">
          {l.city}, {l.country} • {l.bedrooms} bd • {l.baths} ba • up to {l.maxGuests} guests
        </div>

        <div style="margin-top:10px;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap">
          <div class="pill">★ {l.rating} <span class="muted">({l.reviews})</span></div>
          <div class="pill"><strong>{formatUsd(l.pricePerNight)}</strong> <span class="muted">/ night</span></div>
          <a class="pill" href="/stays">← Back to results</a>
        </div>

        <div data-testid="stay-description" style="margin-top:14px" innerHTML={l.descriptionHtml} />
      </div>
    </Layout>
  );
}
