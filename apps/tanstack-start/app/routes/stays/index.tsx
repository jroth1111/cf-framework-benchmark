import { createFileRoute } from "@tanstack/react-router";
import { listings } from "@cf-bench/dataset";

export const Route = createFileRoute("/stays/")({
  loader: ({ request, location }) => {
    const locationUrl =
      location?.href ||
      (location?.pathname ? `${location.pathname}${location.search ?? ""}` : null);
    const url = new URL(request?.url ?? locationUrl ?? "/stays", "http://localhost");
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
  },
});
