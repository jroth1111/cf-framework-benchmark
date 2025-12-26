import { component$ } from "@qwik.dev/core";
import { Link, routeLoader$ } from "@qwik.dev/router";
import { listings, formatUsd } from "@cf-bench/dataset";

export const useStays = routeLoader$(({ url }) => {
  const city = url.searchParams.get("city") ?? "";
  const maxRaw = url.searchParams.get("max") ?? "";
  const maxNum = maxRaw ? Number(maxRaw) : null;

  const cities = Array.from(new Set(listings.map((l) => l.city))).sort();
  const filtered = listings.filter((l) => {
    if (city && l.city !== city) return false;
    if (maxNum != null && Number.isFinite(maxNum) && l.pricePerNight > maxNum) return false;
    return true;
  });

  return { city, maxRaw, cities, filtered };
});

export const StayCard = component$<{ listing: typeof listings[0] }>((props) => {
  const handleNavigate$ = () => {
    try {
      console.log(`[Qwik] Navigating to /stays/${props.listing.id}`);
      // Link component handles client navigation automatically
      console.log(`[Qwik] Navigation initiated`);
    } catch (err) {
      console.error('[Qwik] Navigation error:', err);
      // Fallback: use window.location
      window.location.href = `/stays/${props.listing.id}`;
    }
  };

  return (
    <Link
      class="card"
      data-testid="stay-card"
      href={`/stays/${props.listing.id}`}
      style="padding:14px;display:block"
      onClick$={handleNavigate$}
    >
      <div style="display:flex;justify-content:space-between;gap:12px">
        <div>
          <div style="font-weight:700">{props.listing.title}</div>
          <div class="muted small">
            {props.listing.city}, {props.listing.country} • {props.listing.bedrooms} bd • {props.listing.baths} ba • up to {props.listing.maxGuests} guests
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700">
            {formatUsd(props.listing.pricePerNight)} <span class="muted small">/ night</span>
          </div>
          <div class="muted small">★ {props.listing.rating} ({props.listing.reviews})</div>
        </div>
      </div>
      <div class="muted small" style="margin-top:10px">{props.listing.summary}</div>
    </Link>
  );
});

export default component$(() => {
  const data = useStays().value;
  return (
    <>
      <h1 class="h1">Stays</h1>

      <form method="get" action="/stays" class="card" style="padding:14px;margin-bottom:14px">
        <div class="grid cols-3">
          <div>
            <div class="small muted">City</div>
            <select class="input" name="city" value={data.city}>
              <option value="">Any</option>
              {data.cities.map((c) => (
                <option value={c} selected={c === data.city}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div class="small muted">Max price</div>
            <input class="input" name="max" value={data.maxRaw} placeholder="e.g. 250" inputMode="numeric" />
          </div>
          <div style="display:flex;align-items:end">
            <button class="btn" type="submit">Apply</button>
          </div>
        </div>
      </form>

      <div class="grid cols-2">
        {data.filtered.map((l) => (
          <StayCard listing={l} />
        ))}
      </div>
    </>
  );
});
