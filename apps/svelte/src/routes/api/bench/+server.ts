import { handleContractApi } from "@cf-bench/bench-contract";

export async function GET({ request }: { request: Request }) {
  return handleContractApi("svelte", request)!;
}
