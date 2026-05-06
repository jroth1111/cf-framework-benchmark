import { getHifiStayDetailParts } from "@cf-bench/hifi-shell";
import type { Route } from "./+types/hifi-stay-detail";
import { getListing } from "../lib/data";

export function loader({ params }: Route.LoaderArgs) {
  const listing = getListing(params.id || "");
  return { listing: listing ?? null };
}

export default function HifiStayDetailRoute({ loaderData }: Route.ComponentProps) {
  const parts = getHifiStayDetailParts(loaderData.listing ?? undefined);
  return (
    <>
      <script async src="/__bench/sdk/maps.js" />
      <script async src="/__bench/sdk/analytics.js" />
      <div dangerouslySetInnerHTML={{ __html: parts.body }} />
      {parts.script ? <script dangerouslySetInnerHTML={{ __html: parts.script }} /> : null}
    </>
  );
}
