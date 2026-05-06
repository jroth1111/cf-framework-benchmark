import { createLazyFileRoute } from "@tanstack/react-router";
import { renderHifiStaysListBody } from "@cf-bench/hifi-shell";

export const Route = createLazyFileRoute("/hifi/stays/")({
  component: HifiStays,
});

function HifiStays() {
  const listings = Route.useLoaderData();
  const html = renderHifiStaysListBody(listings);
  return (
    <>
      <script async src="/__bench/sdk/maps.js" />
      <script async src="/__bench/sdk/analytics.js" />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
