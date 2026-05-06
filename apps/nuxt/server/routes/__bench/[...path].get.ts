import { handleContractApi } from "@cf-bench/bench-contract";
import { eventToRequest } from "../../utils/bench";

export default defineEventHandler(async (event) => {
  const response = handleContractApi("nuxt", eventToRequest(event));
  if (response) return response;
  setResponseStatus(event, 404);
  return "Not Found";
});
