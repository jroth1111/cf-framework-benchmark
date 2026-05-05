import { handleHealth } from "@cf-bench/bench-contract";

export function GET() {
  return handleHealth();
}
