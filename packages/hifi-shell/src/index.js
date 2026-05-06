import { formatUsd } from "@cf-bench/dataset";

const HEAD_HTML =
  '<script async src="/__bench/sdk/maps.js"></script>' +
  '<script async src="/__bench/sdk/analytics.js"></script>';

const BOOKING_SCRIPT = `(function(){
  function compute(form){
    var checkin = form.querySelector('input[name="checkin"]');
    var checkout = form.querySelector('input[name="checkout"]');
    var guests = form.querySelector('input[name="guests"]');
    var nightsRaw = (new Date(checkout && checkout.value) - new Date(checkin && checkin.value));
    var nights = Math.max(1, Math.round(nightsRaw / 86400000));
    var pricePerNight = Number(form.dataset.priceNight || 0);
    var cleaningFee = Number(form.dataset.cleaningFee || 0);
    var serviceFee = Number(form.dataset.serviceFee || 0);
    var party = Math.max(1, Number((guests && guests.value) || 1));
    var subtotal = nights * pricePerNight;
    var total = subtotal + cleaningFee + serviceFee;
    return { nights: nights, party: party, subtotal: subtotal, total: total };
  }
  function attach(form){
    if (form.__cfBenchBound) return;
    form.__cfBenchBound = true;
    form.addEventListener('submit', function(ev){
      ev.preventDefault();
      var r = compute(form);
      var totalEl = document.querySelector('[data-testid="stay-booking-total"]');
      if (totalEl) {
        totalEl.textContent = '$' + r.total.toFixed(2) + ' for ' + r.nights + ' night' + (r.nights === 1 ? '' : 's') + ' (' + r.party + ' guest' + (r.party === 1 ? '' : 's') + ')';
        totalEl.hidden = false;
      }
    });
  }
  function init(){
    var forms = document.querySelectorAll('[data-testid="stay-booking-form"]');
    for (var i = 0; i < forms.length; i++) attach(forms[i]);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();`;

/**
 * Idempotent client-side wiring of the hifi booking form. Mirrors the logic
 * of BOOKING_SCRIPT but exposed as a callable so frameworks whose template
 * engines (Svelte's {@html}, Solid's innerHTML, etc.) cannot execute injected
 * script tags can attach the same handler from a mount/hydrate hook.
 */
export function attachHifiBookingForms() {
  if (typeof document === "undefined") return;
  const forms = document.querySelectorAll('[data-testid="stay-booking-form"]');
  forms.forEach((form) => {
    if (form.__cfBenchBound) return;
    form.__cfBenchBound = true;
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      const checkin = form.querySelector('input[name="checkin"]');
      const checkout = form.querySelector('input[name="checkout"]');
      const guests = form.querySelector('input[name="guests"]');
      const nightsRaw = new Date(checkout && checkout.value) - new Date(checkin && checkin.value);
      const nights = Math.max(1, Math.round(nightsRaw / 86400000));
      const pricePerNight = Number(form.dataset.priceNight || 0);
      const cleaningFee = Number(form.dataset.cleaningFee || 0);
      const serviceFee = Number(form.dataset.serviceFee || 0);
      const party = Math.max(1, Number((guests && guests.value) || 1));
      const subtotal = nights * pricePerNight;
      const total = subtotal + cleaningFee + serviceFee;
      const totalEl = document.querySelector('[data-testid="stay-booking-total"]');
      if (totalEl) {
        totalEl.textContent = `$${total.toFixed(2)} for ${nights} night${nights === 1 ? "" : "s"} (${party} guest${party === 1 ? "" : "s"})`;
        totalEl.hidden = false;
      }
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function renderHifiStaysListBody(listings) {
  const cards = listings
    .map((l) => {
      const heroSrc = l.heroPhoto || "";
      const title = escapeHtml(l.title);
      const summary = escapeHtml(l.summary);
      const meta = `${escapeHtml(l.city)}, ${escapeHtml(l.country)} • ${l.bedrooms} bd • ${l.baths} ba • up to ${l.maxGuests} guests`;
      const price = `${escapeHtml(formatUsd(l.pricePerNight))} <span class="muted small">/ night</span>`;
      return (
        `<a class="card" data-testid="stay-card" href="/hifi/stays/${escapeAttr(l.id)}" style="display:block;padding:14px">` +
          `<img src="${escapeAttr(heroSrc)}" alt="${escapeAttr(l.title)}" width="800" height="533" loading="lazy" decoding="async" style="width:100%;height:auto;border-radius:12px;display:block;aspect-ratio:3/2;object-fit:cover" />` +
          `<div style="display:flex;justify-content:space-between;gap:12px;margin-top:10px">` +
            `<div><div style="font-weight:700">${title}</div><div class="muted small">${meta}</div></div>` +
            `<div style="text-align:right"><div style="font-weight:700">${price}</div><div class="muted small">★ ${l.rating} (${l.reviews})</div></div>` +
          `</div>` +
          `<div class="muted small" style="margin-top:10px">${summary}</div>` +
        `</a>`
      );
    })
    .join("");
  return `<h1 class="h1">Stays (hifi)</h1><p class="muted">High-fidelity Airbnb-shape listing index.</p><div class="grid cols-2">${cards}</div>`;
}

function renderGalleryHtml(photos) {
  if (!photos || photos.length === 0) return "";
  const items = photos
    .slice(1, 8)
    .map((src, i) => {
      return (
        `<img src="${escapeAttr(src)}" alt="Photo ${i + 2}" width="800" height="533" loading="lazy" decoding="async" style="width:100%;height:auto;border-radius:8px;display:block;aspect-ratio:3/2;object-fit:cover" />`
      );
    })
    .join("");
  return `<div data-testid="stay-gallery" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px">${items}</div>`;
}

function renderReviewsHtml(reviewSamples) {
  if (!reviewSamples || reviewSamples.length === 0) return "";
  const items = reviewSamples
    .map((r) => {
      return (
        `<li style="padding:12px;border:1px solid #e5e5e5;border-radius:12px">` +
          `<div style="display:flex;justify-content:space-between;gap:8px"><strong>${escapeHtml(r.name)}</strong><span class="muted small">★ ${r.rating}</span></div>` +
          `<div class="muted small">${escapeHtml(r.dateISO)}</div>` +
          `<p style="margin:8px 0 0">${escapeHtml(r.text)}</p>` +
        `</li>`
      );
    })
    .join("");
  return `<section><h3>Reviews</h3><ul data-testid="stay-reviews" style="list-style:none;padding:0;display:grid;gap:10px">${items}</ul></section>`;
}

function renderBookingFormHtml(listing) {
  const checkinDefault = "2026-06-15";
  const checkoutDefault = "2026-06-18";
  const maxGuests = Math.max(1, Number(listing.maxGuests) || 1);
  return (
    `<form data-testid="stay-booking-form" data-price-night="${escapeAttr(listing.pricePerNight)}" data-cleaning-fee="${escapeAttr(listing.cleaningFee)}" data-service-fee="${escapeAttr(listing.serviceFee)}" style="position:sticky;top:14px;display:grid;gap:8px;padding:14px;border:1px solid #e5e5e5;border-radius:14px;background:#fff">` +
      `<div style="font-weight:700">${escapeHtml(formatUsd(listing.pricePerNight))} <span class="muted small">/ night</span></div>` +
      `<label style="display:grid;gap:4px"><span class="small muted">Check-in</span><input type="date" name="checkin" value="${escapeAttr(checkinDefault)}" /></label>` +
      `<label style="display:grid;gap:4px"><span class="small muted">Check-out</span><input type="date" name="checkout" value="${escapeAttr(checkoutDefault)}" /></label>` +
      `<label style="display:grid;gap:4px"><span class="small muted">Guests</span><input type="number" name="guests" min="1" max="${maxGuests}" value="1" /></label>` +
      `<button class="btn" type="submit">Reserve</button>` +
      `<output data-testid="stay-booking-total" hidden style="font-weight:700"></output>` +
    `</form>`
  );
}

function renderHifiStayDetailBody(listing) {
  const heroSrc = listing.heroPhoto || "";
  const title = escapeHtml(listing.title);
  const meta = `${escapeHtml(listing.city)}, ${escapeHtml(listing.country)} • ${listing.bedrooms} bd • ${listing.baths} ba • up to ${listing.maxGuests} guests`;
  const description = listing.descriptionHtmlHifi || listing.descriptionHtml || "";
  const hero =
    `<img data-testid="stay-hero-image" src="${escapeAttr(heroSrc)}" alt="${escapeAttr(listing.title)}" width="1600" height="1067" fetchpriority="high" decoding="async" style="width:100%;height:auto;border-radius:14px;display:block;aspect-ratio:3/2;object-fit:cover" />`;
  const map =
    `<img data-testid="stay-map" src="${escapeAttr(listing.mapTilesUrl || "")}" alt="Map of ${escapeAttr(listing.city)}" width="800" height="400" loading="lazy" decoding="async" style="width:100%;height:auto;border-radius:12px;display:block;aspect-ratio:2/1;object-fit:cover;margin-top:14px" />`;
  const hostAvatar = listing.hostAvatar
    ? `<img src="${escapeAttr(listing.hostAvatar)}" alt="${escapeAttr(listing.hostName)}" width="64" height="64" loading="lazy" decoding="async" style="width:64px;height:64px;border-radius:50%;display:block;object-fit:cover" />`
    : "";
  const gallery = renderGalleryHtml(listing.photos);
  const reviews = renderReviewsHtml(listing.reviewSamples);
  const bookingForm = renderBookingFormHtml(listing);

  return (
    `<a class="pill" href="/hifi/stays" style="display:inline-block;margin-bottom:10px">← Back to results</a>` +
    `<h1 class="h1" style="margin-top:0">${title}</h1>` +
    `<div class="muted small">${meta}</div>` +
    `<div style="display:grid;grid-template-columns:1fr;gap:14px;margin-top:12px">` +
      hero +
      gallery +
    `</div>` +
    `<div style="display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:18px;margin-top:18px">` +
      `<div>` +
        `<section style="display:flex;gap:12px;align-items:center">${hostAvatar}<div><div style="font-weight:700">Hosted by ${escapeHtml(listing.hostName)}</div><div class="muted small">Since ${escapeHtml(listing.hostSinceISO)}</div></div></section>` +
        `<div data-testid="stay-description" style="margin-top:14px">${description}</div>` +
        reviews +
        map +
      `</div>` +
      `<aside>${bookingForm}</aside>` +
    `</div>`
  );
}

function notFoundBody() {
  return (
    `<h1 class="h1">Stay not found</h1>` +
    `<div class="card" style="padding:16px"><p>Unknown listing.</p><a class="pill" href="/hifi/stays">Back</a></div>`
  );
}

export function getHifiHeadHtml() {
  return HEAD_HTML;
}

export function getHifiBookingScript() {
  return BOOKING_SCRIPT;
}

export { renderHifiStaysListBody, renderHifiStayDetailBody };

export function getHifiStayDetailParts(listing) {
  if (!listing) {
    return { head: HEAD_HTML, body: notFoundBody(), script: "", notFound: notFoundBody() };
  }
  return {
    head: HEAD_HTML,
    body: renderHifiStayDetailBody(listing),
    script: BOOKING_SCRIPT,
    notFound: notFoundBody(),
  };
}
