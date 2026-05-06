import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";
import { getListing } from "../../../../src/bench";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const listing = getListing(pageContext.routeParams.id);
  const config = useConfig();

  if (listing) {
    config({
      title: `${listing.title} | CF Bench`,
      description: listing.summary,
    });
  }

  return { listing };
}
