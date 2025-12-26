import { createMemo, createSignal, onMount, Show, For } from "solid-js";
import { listings, formatUsd } from "@cf-bench/dataset";
import { Layout } from "../components/Layout";
import { useNavigate } from "@solidjs/router";

function getSearchParams() {
  const sp = new URLSearchParams(window.location.search);
  return {
    city: sp.get("city") ?? "",
    max: sp.get("max") ?? "",
  };
}

export function Stays() {
  const { city, max } = getSearchParams();
  const maxNum = max ? Number(max) : null;
  const [mounted, setMounted] = createSignal(false);
  const navigate = useNavigate();

  async function navigateToStay(id: string) {
    try {
      console.log(`[Solid] Navigating to /stays/${id}`);
      navigate(`/stays/${id}`);
      console.log(`[Solid] Navigation successful`);
    } catch (err) {
      console.error('[Solid] Navigation error:', err);
      // Fallback: use anchor tag navigation
      window.location.href = `/stays/${id}`;
    }
  }

  const cities = createMemo(() => {
    const s = new Set(listings.map((l) => l.city));
    return ["", ...Array.from(s).sort()];
  });

  const filtered = createMemo(() => {
    return listings.filter((l) => {
      if (city && l.city !== city) return false;
      if (maxNum != null && Number.isFinite(maxNum) && l.pricePerNight > maxNum) return false;
      return true;
    });
  });

  // Optimize: Show skeleton before mounting
  onMount(() => {
    requestAnimationFrame(() => {
      setMounted(true);
    });
  });

  return (
    <Layout title="Stays">
      <form method="get" action="/stays" class="card" style="padding:14px;margin-bottom:14px">
        <div class="grid cols-3">
          <div>
            <div class="small muted">City</div>
            <select class="input" name="city" value={city}>
              <For each={cities()}>
                {(c) => (
                  <option value={c}>{c || "Any"}</option>
                )}
              </For>
            </select>
          </div>
          <div>
            <div class="small muted">Max price</div>
            <input class="input" name="max" value={max} placeholder="e.g. 250" inputmode="numeric" />
          </div>
          <div style="display:flex;align-items:end">
            <button class="btn" type="submit">Apply</button>
          </div>
        </div>
      </form>

      <Show when={mounted()} fallback={
        <div class="grid cols-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} class="card" style="padding:14px;">
              <div class="skeleton" style="height: 32px; width: 60%; margin-bottom: 12px;" />
              <div class="skeleton" style="height: 16px; width: 80%; margin-bottom: 8px;" />
              <div class="skeleton" style="height: 16px; width: 40%;" />
            </div>
          ))}
        </div>
      }>
        <div class="grid cols-2">
          <For each={filtered()}>
            {(l) => (
              <div
                class="card"
                data-testid="stay-card"
                style="padding:14px;cursor:pointer;user-select:none;"
                role="button"
                tabIndex={0}
                onClick={() => navigateToStay(l.id)}
                onKeyDown={(e) => e.key === "Enter" && navigateToStay(l.id)}
              >
                <div style="display:flex;justify-content:space-between;gap:12px">
                  <div>
                    <div style="font-weight:700">{l.title}</div>
                    <div class="muted small">
                      {l.city}, {l.country} • {l.bedrooms} bd • {l.baths} ba • up to {l.maxGuests} guests
                    </div>
                  </div>
                  <div style="text-align:right">
                    <div style="font-weight:700">
                      {formatUsd(l.pricePerNight)} <span class="muted small">/ night</span>
                    </div>
                    <div class="muted small">★ {l.rating} ({l.reviews})</div>
                  </div>
                </div>
                <div class="muted small" style="margin-top:10px">{l.summary}</div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </Layout>
  );
}
