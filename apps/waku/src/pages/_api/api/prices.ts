import { handlePrices } from '@cf-bench/bench-contract';

export async function GET(req: Request) {
  return handlePrices(req);
}
