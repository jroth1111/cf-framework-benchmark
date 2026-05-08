import type { RequestHandler } from "@qwik.dev/router";
import { handleContractApi } from "@cf-bench/bench-contract";

export const onGet: RequestHandler = ({ send, url }) => {
  send(handleContractApi("qwik", url.href)!);
};
