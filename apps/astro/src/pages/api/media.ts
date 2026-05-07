import { handleContractApi } from "@cf-bench/bench-contract";

export const prerender = false;

export function GET({ request }: { request: Request }) {
  return handleContractApi("astro", request)!;
}
