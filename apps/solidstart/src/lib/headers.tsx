import { HttpHeader } from "@solidjs/start";
import { getRequestEvent } from "solid-js/web";
import { htmlCacheHeader } from "@cf-bench/bench-cache";

export function BenchHeaders(props: { routeId: string }) {
  const event = getRequestEvent();
  const profile = event?.request.headers.get("x-cf-bench-profile") ?? null;
  return (
    <>
      <HttpHeader name="cache-control" value={htmlCacheHeader(props.routeId, profile)} />
    </>
  );
}
