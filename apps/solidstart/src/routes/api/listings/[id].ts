import { handleListing } from "@cf-bench/bench-contract";

export function GET(event: { params: { id: string } }) {
  return handleListing(event.params.id);
}
