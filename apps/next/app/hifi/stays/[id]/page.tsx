import { getListing } from "@cf-bench/dataset";
import { getHifiStayDetailParts } from "@cf-bench/hifi-shell";

export default async function HifiStayDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = getListing(id);
  const parts = getHifiStayDetailParts(listing);

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: parts.body }} />
      {parts.script ? <script dangerouslySetInnerHTML={{ __html: parts.script }} /> : null}
    </>
  );
}
