import { renderHifiStaysListBody } from "@cf-bench/hifi-shell";
import type { Route } from "./+types/hifi-stays";
import { queryListings } from "../lib/data";

export function loader() {
  return queryListings({ page: 1, pageSize: 12 });
}

export default function HifiStaysRoute({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <script async src="/__bench/sdk/maps.js" />
      <script async src="/__bench/sdk/analytics.js" />
      <div dangerouslySetInnerHTML={{ __html: renderHifiStaysListBody(loaderData.results) }} />
    </>
  );
}
