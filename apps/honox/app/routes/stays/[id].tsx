import { createRoute } from "honox/factory";
import { getListing } from "@cf-bench/dataset";

export default createRoute((c) => {
	const id = c.req.param("id") ?? "";
	const listing = getListing(id);
	if (!listing) {
		return c.render(
			<div>
				<h1 class="h1">Stay not found</h1>
				<div class="card">
					<p class="muted">Unknown listing.</p>
				</div>
			</div>,
			{ title: "Stay not found" }
		);
	}
	return c.render(
		<div>
			<a class="pill" href="/stays">
				← Back to listings
			</a>
			<h1 class="h1">{listing.title}</h1>
			<div class="small muted">
				{listing.city}, {listing.country} &bull; {listing.neighborhood}
			</div>
			<div class="card" style="margin-top:12px">
				<div data-testid="stay-description" dangerouslySetInnerHTML={{ __html: listing.descriptionHtml }} />
			</div>
		</div>,
		{ title: listing.title }
	);
});
