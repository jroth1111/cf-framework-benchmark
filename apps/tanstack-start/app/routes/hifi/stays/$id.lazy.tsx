import { createLazyFileRoute } from "@tanstack/react-router";
import { getListing } from "@cf-bench/dataset";
import { getHifiStayDetailParts } from "@cf-bench/hifi-shell";

export const Route = createLazyFileRoute("/hifi/stays/$id")({
  component: HifiStayDetail,
});

function HifiStayDetail() {
  const { id } = Route.useParams();
  const listing = getListing(id);
  const parts = getHifiStayDetailParts(listing);
  return (
    <>
      <script async src="/__bench/sdk/maps.js" />
      <script async src="/__bench/sdk/analytics.js" />
      <div dangerouslySetInnerHTML={{ __html: parts.body }} />
      {parts.script ? (
        <script dangerouslySetInnerHTML={{ __html: parts.script }} />
      ) : null}
    </>
  );
}
