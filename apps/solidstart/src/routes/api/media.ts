import { handleMedia } from "@cf-bench/bench-contract";

export function GET(event: { request: Request }) {
  return handleMedia(event.request);
}
