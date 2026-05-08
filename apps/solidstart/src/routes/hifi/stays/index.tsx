import { queryListings } from "@cf-bench/dataset";
import { renderHifiStaysListBody } from "@cf-bench/hifi-shell";
import { BenchHeaders } from "../../../lib/headers";

export default function HifiStaysPage() {
  const listings = queryListings({ page: 1, pageSize: 12 }).results;
  const html = renderHifiStaysListBody(listings);
  return (
    <>
      <BenchHeaders routeId="/hifi/stays" />
      <script async src="/__bench/sdk/maps.js" />
      <script async src="/__bench/sdk/analytics.js" />
      <div innerHTML={html} />
    </>
  );
}
