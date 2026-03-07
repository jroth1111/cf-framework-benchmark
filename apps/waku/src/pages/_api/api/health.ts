import { handleHealth } from '@cf-bench/bench-contract';

export async function GET() {
  return handleHealth();
}
