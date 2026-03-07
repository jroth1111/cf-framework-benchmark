import { handleListing } from '@cf-bench/bench-contract';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function GET(_req: Request, { params }: { params: Record<string, string | string[]> }) {
  return handleListing(firstParam(params.id) ?? '');
}
