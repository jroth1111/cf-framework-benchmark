import { renderHifiStaysListBody } from "@cf-bench/hifi-shell";
import { queryListings } from "../../../../src/bench";

export default function Page() {
  const listings = queryListings({ page: 1, pageSize: 12 }).results;
  const bodyHtml = renderHifiStaysListBody(listings);
  return <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />;
}
