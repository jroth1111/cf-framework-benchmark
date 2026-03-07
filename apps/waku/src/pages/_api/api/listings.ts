import { handleListings } from '@cf-bench/bench-contract';

export async function GET(req: Request) {
  return handleListings(req);
}
