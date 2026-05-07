import { handleContractApi } from "@cf-bench/bench-contract";

export async function GET(req: Request) {
  return handleContractApi("next", req)!;
}
