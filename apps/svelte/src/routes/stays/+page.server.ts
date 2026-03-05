import type { PageServerLoad } from "./$types";
import { listings } from "@cf-bench/dataset";
import { benchCacheHeader } from "$lib/bench-cache";

export const load: PageServerLoad = async ({ url, request, setHeaders }) => {
  const cache = benchCacheHeader(request.headers.get("x-cf-bench-profile"), "list");
  if (cache) setHeaders({ "cache-control": cache });

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
};
