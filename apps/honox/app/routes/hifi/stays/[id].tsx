import { createRoute } from "honox/factory";
import { getListing } from "@cf-bench/dataset";
import { getHifiStayDetailParts } from "@cf-bench/hifi-shell";

export default createRoute((c) => {
	const id = c.req.param("id") ?? "";
	const listing = getListing(id);
	const parts = getHifiStayDetailParts(listing);
	if (!listing) {
		c.status(404);
	}
	return c.render(
		<>
			<script async src="/__bench/sdk/maps.js" />
			<script async src="/__bench/sdk/analytics.js" />
			<div dangerouslySetInnerHTML={{ __html: parts.body }} />
			{listing ? <script dangerouslySetInnerHTML={{ __html: parts.script }} /> : null}
		</>,
		{ title: listing ? listing.title : "Stay not found", hifi: true }
	);
});
