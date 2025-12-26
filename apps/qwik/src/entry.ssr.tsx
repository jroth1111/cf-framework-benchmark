import { renderToStream } from "@qwik.dev/core/server";
import Root from "./root";
import { manifest } from "@qwik-client-manifest";

export default function (opts: any) {
  return renderToStream(<Root />, { ...opts, manifest });
}
