import { defineComponent, h } from "vue";
import { RouterLink } from "vue-router";
import { formatUsd, queryListings } from "@cf-bench/dataset";

export default defineComponent({
	name: "StaysPage",
	setup() {
		const results = queryListings({ page: 1, pageSize: 12 }).results;
		return () =>
			h("div", [
				h("h1", { class: "h1" }, "Stays"),
				h("p", { class: "muted" }, "Airbnb-style listing index rendered by Vue and served from Cloudflare Workers assets."),
				h(
					"div",
					{ class: "grid cols-3", style: { marginTop: "12px" } },
					results.map((listing) =>
						h(
							RouterLink,
							{
								key: listing.id,
								to: `/stays/${listing.id}`,
								"data-testid": "stay-card",
								class: "card",
							},
							{
								default: () => [
									h("div", { style: { fontWeight: "700" } }, listing.title),
									h("div", { class: "small muted" }, `${listing.city}, ${listing.country} • ${listing.bedrooms} bd • ${listing.baths} ba • up to ${listing.maxGuests} guests`),
									h("div", { style: { marginTop: "8px" } }, [
										h("strong", formatUsd(listing.pricePerNight)),
										" ",
										h("span", { class: "muted small" }, "/ night"),
									]),
									h("div", { class: "small muted", style: { marginTop: "6px" } }, `★ ${listing.rating} (${listing.reviews} reviews)`),
									h("p", { class: "muted small" }, listing.summary),
								],
							},
						),
					),
				),
			]);
	},
});
