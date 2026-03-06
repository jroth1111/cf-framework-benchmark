import { handleContractApi } from "@cf-bench/bench-contract";

export async function GET({ url }: { url: URL }) {
  return handleContractApi("svelte", url.href)!;
}
