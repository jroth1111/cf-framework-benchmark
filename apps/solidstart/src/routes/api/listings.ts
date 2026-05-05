import { handleListings } from "@cf-bench/bench-contract";

export function GET(event: { request: Request }) {
  return handleListings(event.request);
}
