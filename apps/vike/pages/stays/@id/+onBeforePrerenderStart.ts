import { listings } from "../../../src/bench";

export function onBeforePrerenderStart() {
  return Array.from(new Set(listings.map((listing) => `/stays/${listing.id}`)));
}
