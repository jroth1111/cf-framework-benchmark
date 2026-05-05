import { HttpHeader } from "@solidjs/start";

export function BenchHeaders(props: { cacheControl: string }) {
  return (
    <>
      <HttpHeader name="cache-control" value={props.cacheControl} />
      <HttpHeader name="server-timing" value="cf_bench;dur=0.0" />
    </>
  );
}
