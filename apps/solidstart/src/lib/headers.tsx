import { HttpHeader } from "@solidjs/start";

export function BenchHeaders(props: { cacheControl: string }) {
  return (
    <>
      <HttpHeader name="cache-control" value={props.cacheControl} />
    </>
  );
}
