import { defineComponent, h } from "vue";
import { RouterLink } from "vue-router";
import { formatUsd, listings } from "@cf-bench/dataset";

function pillLink(to: string, label: string) {
	return h(
		RouterLink,
		{ class: "pill", to },
		{
			default: () => label,
		},
	);
}

export default defineComponent({
	name: "HomePage",
	setup() {
		const featured = listings.slice(0, 6);
		return () =>
			h("div", [
				h("h1", { class: "h1" }, "Cloudflare Framework Benchmark"),
				h("div", { class: "grid cols-3" }, [
					h("div", { class: "card" }, [
						h("h2", "MPA stays flow"),
						h("p", { class: "muted" }, "Listing index and detail pages owned by Vue and deployed to Workers."),
						h("div", [pillLink("/stays", "Open stays")]),
					]),
					h("div", { class: "card" }, [
						h("h2", "SPA chart flow"),
						h("p", { class: "muted" }, "Interactive chart controls, canvas rendering, and benchmark markers."),
						h("div", [pillLink("/chart", "Open chart")]),
					]),
					h("div", { class: "card" }, [
						h("h2", "Media flow"),
						h("p", { class: "muted" }, "Open and next interactions with Worker API calls and client timing markers."),
						h("div", [pillLink("/media", "Open media")]),
					]),
				]),
				h("h2", { style: { marginTop: "24px" } }, "Featured stays"),
				h(
					"div",
					{ class: "grid cols-3" },
					featured.map((listing) =>
						h(
							RouterLink,
							{ key: listing.id, class: "card", to: `/stays/${listing.id}` },
							{
								default: () => [
									h("div", { style: { fontWeight: "700" } }, listing.title),
									h("div", { class: "small muted" }, `${listing.city}, ${listing.country}`),
									h("div", { style: { marginTop: "8px" } }, [
										h("strong", formatUsd(listing.pricePerNight)),
										" ",
										h("span", { class: "muted small" }, "/ night"),
									]),
								],
							},
						),
					),
				),
			]);
	},
});
