import { handleBench } from "@cf-bench/bench-contract";

export function GET() {
  return handleBench("solidstart");
}
