import { handleBench } from '@cf-bench/bench-contract';

export async function GET() {
  return handleBench('waku');
}
