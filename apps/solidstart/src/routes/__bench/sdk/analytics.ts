import { handleSdkAnalytics } from "@cf-bench/bench-contract";

export function GET() {
  return handleSdkAnalytics();
}
