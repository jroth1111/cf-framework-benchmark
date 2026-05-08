import { createRoute } from "honox/factory";
import { queryListings } from "@cf-bench/dataset";
import { renderHifiStaysListBody } from "@cf-bench/hifi-shell";

export default createRoute((c) => {
	const listings = queryListings({ page: 1, pageSize: 12 }).results;
	const bodyHtml = renderHifiStaysListBody(listings);
	return c.render(
		<>
			<script async src="/__bench/sdk/maps.js" />
			<script async src="/__bench/sdk/analytics.js" />
			<div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
		</>,
		{ title: "Stays (hifi)", hifi: true }
	);
});
