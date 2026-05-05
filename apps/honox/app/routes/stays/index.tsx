import { createRoute } from "honox/factory";
import { queryListings } from "@cf-bench/dataset";

function esc(v: string | number | null | undefined) {
	return String(v ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export default createRoute((c) => {
	const url = new URL(c.req.raw.url);
	const page = Number(url.searchParams.get("page") || "1");
	const pageSize = Number(url.searchParams.get("pageSize") || "12");
	const data = queryListings({ page, pageSize });

	return c.render(
		<div>
			<h1 class="h1">Stays</h1>
			<p class="muted">Airbnb-style listing index.</p>
			<div class="grid cols-2" style="margin-top:12px">
				{data.results.map((listing) => (
					<a class="card" data-testid="stay-card" href={`/stays/${esc(listing.id)}`}>
						<div style="font-weight:700">{listing.title}</div>
						<div class="small muted">
							{listing.city}, {listing.country} &bull; {listing.bedrooms} bd &bull; {listing.baths} ba
						</div>
						<div style="margin-top:8px">
							<strong>${listing.pricePerNight}</strong>{" "}
							<span class="muted small">/ night</span>
						</div>
					</a>
				))}
			</div>
		</div>,
		{ title: "Stays" }
	);
});
