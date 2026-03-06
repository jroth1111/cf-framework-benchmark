import { handleContractApi } from "@cf-bench/bench-contract";
import { eventToRequest } from "../utils/bench";

export default defineEventHandler((event) => {
  return handleContractApi("nuxt", eventToRequest(event));
});
