import { handleMedia } from '@cf-bench/bench-contract';

export async function GET(req: Request) {
  return handleMedia(req);
}
